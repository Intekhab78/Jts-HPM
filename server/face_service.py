import sys
import os
import time
import json
import base64
import queue
import subprocess
import urllib.request
from io import BytesIO
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import numpy as np
from PIL import Image, ImageOps
import threading

recognition_lock = threading.Lock()

try:
    import face_recognition
except ImportError:
    print("Error: face_recognition library not installed")
    sys.exit(1)

try:
    import cv2
except ImportError:
    print("Warning: cv2 (OpenCV) not installed. IP Camera streaming will be disabled.")
    cv2 = None

app = Flask(__name__)
CORS(app)

# In-memory cache of face encodings: { employeeId: encoding_list }
face_cache = {}
# In-memory cache of employee display names: { employeeId: firstName }
face_cache_names = {}

# Active IP Camera Workers: { device_id: worker_dict }
camera_workers = {}

# Zone-level cooldowns to club cameras in the same area: { zone_key: { employee_id: timestamp } }
zone_cooldowns = {}
visitor_cooldowns = {}
security_alert_cooldowns = {}
cooldown_lock = threading.Lock()

# -------------------------------------------------------------
# Siren Alarm & Voice Audio Helpers
# -------------------------------------------------------------
def play_siren_alarm(duration_seconds=3.0):
    """
    Play security siren alarm through audio device asynchronously
    """
    def _siren_worker():
        try:
            import winsound
            end_time = time.time() + duration_seconds
            while time.time() < end_time:
                try:
                    winsound.Beep(1300, 180)
                    winsound.Beep(850, 180)
                except Exception:
                    break
        except Exception as e:
            print(f"[Siren Worker Warning]: {e}")

    threading.Thread(target=_siren_worker, daemon=True).start()

def is_in_after_hours(start_str='20:00', end_str='06:00'):
    """
    Check if the current local time falls within the configured after-hours surveillance window
    """
    try:
        now_lt = time.localtime()
        cur_min = now_lt.tm_hour * 60 + now_lt.tm_min
        sp = [int(x) for x in str(start_str or '20:00').split(':')]
        ep = [int(x) for x in str(end_str or '06:00').split(':')]
        s_min = sp[0] * 60 + (sp[1] if len(sp) > 1 else 0)
        e_min = ep[0] * 60 + (ep[1] if len(ep) > 1 else 0)
        if s_min > e_min:  # Crosses midnight (e.g. 20:00 to 06:00)
            return (cur_min >= s_min) or (cur_min < e_min)
        else:
            return s_min <= cur_min < e_min
    except Exception:
        return False

# -------------------------------------------------------------
# Asynchronous Background Voice Response Engine
# -------------------------------------------------------------
speech_queue = queue.Queue()
speech_cooldowns = {}
speech_lock = threading.Lock()

def speech_worker_loop():
    """
    Dedicated non-blocking audio worker loop for instant voice feedback
    """
    while True:
        try:
            text = speech_queue.get()
            if text is None:
                break
            
            # Windows SAPI.SpVoice via PowerShell for zero external dependency TTS
            if os.name == 'nt':
                try:
                    escaped_text = text.replace("'", "''").replace('"', '`"')
                    ps_cmd = f"Add-Type -AssemblyName System.speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('{escaped_text}');"
                    subprocess.run(['powershell', '-Command', ps_cmd], capture_output=True, timeout=8)
                except Exception as pse:
                    pass
        except Exception as e:
            print(f"[Speech Worker Error]: {e}")
        finally:
            speech_queue.task_done()

# Launch background speech daemon thread
speech_thread = threading.Thread(target=speech_worker_loop, daemon=True)
speech_thread.start()

def speak_voice_response(text, key=None, cooldown_secs=7.0):
    """
    Enqueue voice feedback message with per-entity cooldown to prevent repetitive audio
    """
    now = time.time()
    with speech_lock:
        if key:
            last_time = speech_cooldowns.get(key, 0.0)
            if (now - last_time) < cooldown_secs:
                return
            speech_cooldowns[key] = now
            
    print(f"[Voice Announcement]: \"{text}\"")
    speech_queue.put(text)

def get_absolute_path(relative_path):
    # Resolve relative to server folder
    base_dir = os.path.dirname(os.path.abspath(__file__))
    rel_path = relative_path.lstrip('/')
    return os.path.join(base_dir, rel_path)

def calculate_score(dist):
    """
    Strict Enterprise Biometric Confidence Curve
    dist <= 0.35 -> 95.0% - 100.0% (Identical Match)
    0.35 < dist <= 0.48 -> 70.0% - 95.0% (High Confidence Match)
    0.48 < dist <= 0.58 -> 40.0% - 70.0% (Lookalike / Family -> REJECTED)
    dist > 0.58 -> < 40.0% (Unknown Stranger -> REJECTED)
    """
    if dist <= 0.35:
        return round(float(95.0 + (0.35 - dist) / 0.35 * 5.0), 1)
    elif dist <= 0.48:
        return round(float(70.0 + (0.48 - dist) / 0.13 * 25.0), 1)
    elif dist <= 0.58:
        return round(float(40.0 + (0.58 - dist) / 0.10 * 30.0), 1)
    else:
        return round(float(max(0.0, 40.0 - (dist - 0.58) * 100.0)), 1)

def extract_face_encodings(img_pil):
    """
    High-accuracy face extraction with EXIF correction, upsampling, and auto-rotation
    """
    with recognition_lock:
        try:
            # 1. Correct EXIF orientation
            img_pil = ImageOps.exif_transpose(img_pil)
            if img_pil.mode != 'RGB':
                img_pil = img_pil.convert('RGB')
            
            # Scale if excessively large to ensure swift processing
            max_dim = 1200
            if max(img_pil.size) > max_dim:
                img_pil.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
                
            image_np = np.array(img_pil)
            
            # Primary scan
            encodings = face_recognition.face_encodings(image_np)
            if encodings:
                return encodings
                
            # Secondary scan with upsample for distant/dim faces
            face_locs = face_recognition.face_locations(image_np, number_of_times_to_upsample=1, model="hog")
            if face_locs:
                return face_recognition.face_encodings(image_np, known_face_locations=face_locs)
                
            # Rotation fallback (90, 270, 180 degrees) for mobile front-camera frames
            for angle in [90, 270, 180]:
                rotated = img_pil.rotate(angle, expand=True)
                rotated_np = np.array(rotated)
                rot_encodings = face_recognition.face_encodings(rotated_np)
                if rot_encodings:
                    return rot_encodings

            return []
        except Exception as e:
            print(f"Error in extract_face_encodings: {e}")
            return []

def send_webhook_punch(url, payload):
    """
    Asynchronously notify Node backend of successful IP camera face recognition punch or alert
    """
    def _async_post():
        try:
            req_data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(
                url,
                data=req_data,
                headers={'Content-Type': 'application/json', 'User-Agent': 'IPCamera-FaceRecognition-Worker/1.0'}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                resp_body = resp.read().decode('utf-8')
                if payload.get('employeeId'):
                    print(f"[IP-Camera Punch Recorded]: Device={payload.get('deviceId')} Emp={payload.get('employeeId')} Resp={resp_body}")
                elif payload.get('eventType'):
                    print(f"[IP-Camera Security Alert Sent]: Event={payload.get('eventType')} Device={payload.get('deviceId')} Resp={resp_body}")
        except Exception as e:
            print(f"[IP-Camera Webhook Post Error]: {e}")

    t = threading.Thread(target=_async_post, daemon=True)
    t.start()

def open_video_stream(stream_url):
    """
    Robust video capture initialization supporting RTSP TCP transport, low-latency buffering, and auto-timeout
    """
    if cv2 is None:
        return None

    url_str = str(stream_url).strip()
    # Check if stream_url is an integer webcam index (e.g. "0", "1")
    if url_str.isdigit():
        idx = int(url_str)
        if os.name == 'nt':
            cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
            if cap.isOpened():
                return cap
        return cv2.VideoCapture(idx)

    # Set OpenCV FFMPEG RTSP options for lowest latency, TCP transport, buffer drop, and 4s timeout
    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|stimeout;4000000|max_delay;500000|fflags;nobuffer|flags;low_delay"
    cap = cv2.VideoCapture(url_str, cv2.CAP_FFMPEG)
    if not cap.isOpened():
        cap = cv2.VideoCapture(url_str)
    
    if cap.isOpened():
        try:
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except Exception:
            pass
    return cap

def start_camera_recording(device_id, recording_type='Manual', recording_id=None):
    """
    Start recording video stream frames to a web-playable video file on disk (.webm / .mp4)
    """
    dev_key = str(device_id)
    worker = camera_workers.get(dev_key)
    if not worker or worker.get('status') not in ['running', 'connecting', 'starting']:
        return {"success": False, "message": "Camera is currently offline. Please start stream first."}
    
    if worker.get('is_recording'):
        return {
            "success": True, 
            "message": "Recording already in progress", 
            "filePath": worker.get('recording_rel_path'),
            "isRecording": True,
            "recordingType": worker.get('recording_type')
        }

    w = worker.get('width') or 640
    h = worker.get('height') or 480
    
    recordings_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads', 'recordings')
    os.makedirs(recordings_dir, exist_ok=True)
    
    timestamp_str = int(time.time())
    
    # Try WebM VP90 first for modern browser HTML5 native playback, fallback to MP4 mp4v
    rec_filename = f"rec_{dev_key}_{timestamp_str}.webm"
    rec_full_path = os.path.join(recordings_dir, rec_filename)
    thumb_filename = f"thumb_{dev_key}_{timestamp_str}.jpg"
    thumb_full_path = os.path.join(recordings_dir, thumb_filename)
    
    fps = 10.0 # Standard CCTV recording frame rate
    fourcc = cv2.VideoWriter_fourcc(*'VP90')
    writer = cv2.VideoWriter(rec_full_path, fourcc, fps, (w, h))
    
    if not writer.isOpened():
        # Fallback to standard MP4 container
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        rec_filename = f"rec_{dev_key}_{timestamp_str}.mp4"
        rec_full_path = os.path.join(recordings_dir, rec_filename)
        writer = cv2.VideoWriter(rec_full_path, fourcc, fps, (w, h))

    # Save current frame as thumbnail preview
    if worker.get('latest_frame_bytes'):
        try:
            with open(thumb_full_path, 'wb') as f:
                f.write(worker['latest_frame_bytes'])
        except Exception as te:
            print(f"[Thumbnail Save Warning]: {te}")

    worker['is_recording'] = True
    worker['video_writer'] = writer
    worker['recording_file_path'] = rec_full_path
    worker['recording_rel_path'] = f"/uploads/recordings/{rec_filename}"
    worker['recording_thumb_path'] = f"/uploads/recordings/{thumb_filename}" if os.path.exists(thumb_full_path) else None
    worker['recording_start_time'] = time.time()
    worker['recording_frame_count'] = 0
    worker['recording_type'] = recording_type
    worker['recording_id'] = recording_id
    
    print(f"[Video Recording Started]: Device {dev_key} -> {rec_filename}")
    return {
        "success": True,
        "message": f"Video recording started for Device {dev_key}",
        "filePath": worker['recording_rel_path'],
        "thumbnailPath": worker['recording_thumb_path'],
        "recordingType": recording_type,
        "startTime": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(worker['recording_start_time']))
    }

def stop_camera_recording(device_id):
    """
    Stop active recording, finalize MP4 file, and notify Node backend
    """
    dev_key = str(device_id)
    worker = camera_workers.get(dev_key)
    if not worker or not worker.get('is_recording'):
        return {"success": False, "message": "No active recording found for this camera"}

    writer = worker.get('video_writer')
    if writer:
        writer.release()
    worker['video_writer'] = None
    worker['is_recording'] = False

    end_time = time.time()
    duration_secs = max(1, int(end_time - worker.get('recording_start_time', end_time)))
    
    file_path = worker.get('recording_file_path')
    file_size = os.path.getsize(file_path) if file_path and os.path.exists(file_path) else 0
    
    rel_path = worker.get('recording_rel_path')
    thumb_path = worker.get('recording_thumb_path')
    rec_id = worker.get('recording_id')
    rec_type = worker.get('recording_type', 'Manual')

    # Notify Node backend webhook to save/finalize VideoRecording database entry
    node_complete_url = 'http://127.0.0.1:5000/api/devices/recordings/complete'
    send_webhook_punch(node_complete_url, {
        'deviceId': dev_key,
        'recordingId': rec_id,
        'recordingType': rec_type,
        'filePath': rel_path,
        'thumbnailPath': thumb_path,
        'fileSize': file_size,
        'durationSeconds': duration_secs,
        'startTime': time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(worker.get('recording_start_time', end_time))),
        'endTime': time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(end_time))
    })

    print(f"[Video Recording Saved]: Device {dev_key} -> {rel_path} ({duration_secs}s, {file_size} bytes)")
    return {
        "success": True,
        "message": "Video recording saved successfully",
        "filePath": rel_path,
        "thumbnailPath": thumb_path,
        "durationSeconds": duration_secs,
        "fileSize": file_size
    }

# -------------------------------------------------------------
# Background Video Worker Loop per IP Camera
# -------------------------------------------------------------
def camera_stream_worker_loop(worker_info):
    if cv2 is None:
        worker_info['status'] = 'error'
        worker_info['error_message'] = 'OpenCV cv2 module not available'
        return

    device_id = worker_info['device_id']
    stream_url = worker_info['stream_url']
    location_id = worker_info['location_id']
    zone_group = worker_info['zone_group'] or 'Main Area'
    direction = worker_info['direction'] or 'auto'
    camera_role = worker_info.get('camera_role', 'FaceRecognition')
    security_monitoring = worker_info.get('security_monitoring') or {}
    cooldown_secs = worker_info['cooldown_seconds']
    node_webhook_url = worker_info['node_webhook_url']
    unregistered_webhook_url = worker_info.get('unregistered_webhook_url') or 'http://127.0.0.1:5000/api/devices/unregistered-face-log'
    security_alert_url = worker_info.get('security_alert_webhook_url') or 'http://127.0.0.1:5000/api/nvr/alerts/webhook'
    stop_event = worker_info['stop_event']

    zone_key = f"{location_id}_{zone_group}"
    print(f"[IP-Camera Worker] Starting worker for Device {device_id} [Role: {camera_role}] in Zone '{zone_group}' -> {stream_url}")

    cap = None
    last_process_time = 0.0
    last_read_time = time.time()
    active_boxes = []

    while not stop_event.is_set():
        try:
            now = time.time()
            if cap is None or not cap.isOpened() or (now - last_read_time > 4.5):
                if cap is not None:
                    try:
                        cap.release()
                    except Exception:
                        pass
                    cap = None
                worker_info['status'] = 'connecting'
                cap = open_video_stream(stream_url)
                if cap is None or not cap.isOpened():
                    worker_info['status'] = 'error'
                    worker_info['error_message'] = f'Failed to connect to stream: {stream_url}'
                    time.sleep(2.0)
                    continue
                else:
                    worker_info['status'] = 'running'
                    worker_info['error_message'] = None
                    last_read_time = time.time()

            ret, frame = cap.read()
            if not ret or frame is None:
                worker_info['status'] = 'reconnecting'
                worker_info['error_message'] = 'Connection lost, attempting reconnection...'
                try:
                    cap.release()
                except Exception:
                    pass
                cap = None
                time.sleep(1.5)
                continue

            last_read_time = time.time()
            now = last_read_time
            h, w = frame.shape[:2]
            worker_info['width'] = w
            worker_info['height'] = h
            worker_info['resolution'] = {'width': w, 'height': h}
            worker_info['last_frame_time'] = now
            worker_info['status'] = 'running'
            worker_info['error_message'] = None

            # 1. Write frame to active video recording if enabled
            if worker_info.get('is_recording'):
                if worker_info.get('video_writer') is None and worker_info.get('recording_file_path'):
                    try:
                        fps = 10.0
                        fourcc = cv2.VideoWriter_fourcc(*'VP90')
                        writer = cv2.VideoWriter(worker_info['recording_file_path'], fourcc, fps, (w, h))
                        if not writer.isOpened():
                            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                            writer = cv2.VideoWriter(worker_info['recording_file_path'], fourcc, fps, (w, h))
                        worker_info['video_writer'] = writer
                    except Exception as init_err:
                        print(f"[Lazy Recording Init Error]: {init_err}")

                if worker_info.get('video_writer') is not None:
                    try:
                        worker_info['video_writer'].write(frame)
                        worker_info['recording_frame_count'] = worker_info.get('recording_frame_count', 0) + 1
                    except Exception as rec_err:
                        print(f"[Recording Write Warning]: {rec_err}")

            # 2. Check scheduled recording automation
            if worker_info.get('recording_schedule_enabled'):
                try:
                    now_lt = time.localtime(now)
                    cur_min = now_lt.tm_hour * 60 + now_lt.tm_min
                    st_parts = [int(p) for p in str(worker_info.get('recording_schedule_start', '09:00')).split(':')]
                    st_min = st_parts[0] * 60 + (st_parts[1] if len(st_parts) > 1 else 0)
                    dur_min = int(float(worker_info.get('recording_schedule_duration', 8)) * 60)
                    end_min = st_min + dur_min
                    
                    in_sched = (st_min <= cur_min < end_min)
                    if in_sched and not worker_info.get('is_recording'):
                        start_camera_recording(device_id, recording_type='Scheduled')
                    elif not in_sched and worker_info.get('is_recording') and worker_info.get('recording_type') == 'Scheduled':
                        stop_camera_recording(device_id)
                except Exception:
                    pass

            # 3. High-Speed Face Recognition Scanner (runs every ~250ms on downscaled 480px frame)
            if now - last_process_time >= 0.25:
                last_process_time = now

                # Resize frame to 480px width for lightning-fast HOG detection (< 40ms)
                target_w = 480
                scale = float(target_w) / float(w) if w > target_w else 1.0
                if scale < 1.0:
                    small_frame = cv2.resize(frame, (target_w, int(h * scale)))
                else:
                    small_frame = frame.copy()

                rgb_small = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)

                # Detect face bounding boxes
                with recognition_lock:
                    face_locations = face_recognition.face_locations(rgb_small, number_of_times_to_upsample=0, model="hog")

                if face_locations:
                    with recognition_lock:
                        face_encodings = face_recognition.face_encodings(rgb_small, known_face_locations=face_locations)

                    # Prepare candidate array from cache
                    with recognition_lock:
                        cached_ids = list(face_cache.keys())
                        cached_vecs = [np.array(face_cache[eid]) for eid in cached_ids] if cached_ids else []

                    new_boxes = []
                    for (top, right, bottom, left), face_enc in zip(face_locations, face_encodings):
                        # Scale coordinates back to original frame size
                        orig_top = int(top / scale)
                        orig_right = int(right / scale)
                        orig_bottom = int(bottom / scale)
                        orig_left = int(left / scale)

                        matched_emp_id = None
                        best_score = 0.0
                        best_dist = 1.0

                        if cached_vecs:
                            with recognition_lock:
                                distances = face_recognition.face_distance(cached_vecs, face_enc)
                            min_idx = int(np.argmin(distances))
                            min_dist = float(distances[min_idx])
                            score = calculate_score(min_dist)

                            if min_dist <= 0.48 and score >= 70.0:
                                matched_emp_id = cached_ids[min_idx]
                                best_score = score
                                best_dist = min_dist

                        # Crop face snapshot for logging / alerts
                        pad = 35
                        crop_y1 = max(0, min(h - 1, orig_top - pad))
                        crop_y2 = max(crop_y1 + 1, min(h, orig_bottom + pad))
                        crop_x1 = max(0, min(w - 1, orig_left - pad))
                        crop_x2 = max(crop_x1 + 1, min(w, orig_right + pad))
                        face_crop = frame[crop_y1:crop_y2, crop_x1:crop_x2]
                        
                        crop_b64 = ""
                        if face_crop.size > 0:
                            _, crop_buf = cv2.imencode('.jpg', face_crop, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
                            crop_b64 = base64.b64encode(crop_buf).decode('utf-8')

                        if matched_emp_id:
                            # Matched Registered Employee!
                            first_name = face_cache_names.get(matched_emp_id, "Employee")

                            # 1. Process Attendance Punch (if camera handles Face Attendance)
                            if camera_role in ['FaceRecognition', 'Hybrid']:
                                with cooldown_lock:
                                    if zone_key not in zone_cooldowns:
                                        zone_cooldowns[zone_key] = {}
                                    last_punch_time = zone_cooldowns[zone_key].get(matched_emp_id, 0.0)
                                    is_cooled_down = (now - last_punch_time) >= cooldown_secs

                                    if is_cooled_down:
                                        zone_cooldowns[zone_key][matched_emp_id] = now
                                        worker_info['total_punches'] += 1
                                        worker_info['last_punch'] = {
                                            'employeeId': matched_emp_id,
                                            'score': best_score,
                                            'time': time.strftime("%H:%M:%S", time.localtime(now)),
                                            'direction': direction,
                                            'zone': zone_group
                                        }

                                        # Voice Announcement for verified employee
                                        dir_label = "Check In" if direction == 'in' else ("Check Out" if direction == 'out' else "Attendance")
                                        speak_voice_response(
                                            f"Thank you {first_name}, {dir_label} recorded successfully.",
                                            key=f"emp_{matched_emp_id}",
                                            cooldown_secs=cooldown_secs
                                        )

                                        # Send punch webhook to Node
                                        send_webhook_punch(node_webhook_url, {
                                            'deviceId': device_id,
                                            'employeeId': matched_emp_id,
                                            'faceMatchScore': best_score,
                                            'punchPhotoBase64': f"data:image/jpeg;base64,{crop_b64}" if crop_b64 else None,
                                            'punchType': direction,
                                            'timestamp': time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(now))
                                        })

                            # 2. Check After-Hours Breach for Security Alert
                            if security_monitoring.get('alertAfterHours'):
                                ah_start = security_monitoring.get('afterHoursStart', '20:00')
                                ah_end = security_monitoring.get('afterHoursEnd', '06:00')
                                if is_in_after_hours(ah_start, ah_end):
                                    with cooldown_lock:
                                        if zone_key not in security_alert_cooldowns:
                                            security_alert_cooldowns[zone_key] = {}
                                        last_ah = security_alert_cooldowns[zone_key].get(f"ah_{matched_emp_id}", 0.0)
                                        if (now - last_ah) >= 60.0:
                                            security_alert_cooldowns[zone_key][f"ah_{matched_emp_id}"] = now
                                            send_webhook_punch(security_alert_url, {
                                                'deviceId': device_id,
                                                'eventType': 'AfterHoursMovement',
                                                'title': f'After-Hours Access: {first_name}',
                                                'description': f'Employee {matched_emp_id} ({first_name}) entered {zone_group} during after-hours surveillance.',
                                                'severity': 'Medium',
                                                'employeeId': matched_emp_id,
                                                'personName': first_name,
                                                'faceMatchScore': best_score,
                                                'photoBase64': f"data:image/jpeg;base64,{crop_b64}" if crop_b64 else None,
                                                'timestamp': time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(now))
                                            })

                            new_boxes.append({
                                'box': (orig_left, orig_top, orig_right, orig_bottom),
                                'label': f"{matched_emp_id} ({best_score}%)",
                                'color': (0, 220, 0),
                                'expires': now + 1.6
                            })

                        else:
                            # Unregistered Visitor / Stranger Face Detected
                            visitor_cooldown_secs = 30.0
                            with cooldown_lock:
                                if zone_key not in visitor_cooldowns:
                                    visitor_cooldowns[zone_key] = 0.0
                                last_vis_time = visitor_cooldowns[zone_key]
                                is_vis_cooled_down = (now - last_vis_time) >= visitor_cooldown_secs

                                if is_vis_cooled_down:
                                    visitor_cooldowns[zone_key] = now
                                    worker_info['visitor_count'] += 1
                                    worker_info['last_visitor_time'] = time.strftime("%H:%M:%S", time.localtime(now))

                                    # 1. Voice Announcement / Warning
                                    if camera_role == 'RestrictedArea':
                                        play_siren_alarm(duration_seconds=1.2)
                                        speak_voice_response("Attention! You have entered a restricted area. Security has been notified.", key=f"restr_{zone_key}", cooldown_secs=10.0)
                                    else:
                                        speak_voice_response("Face not recognized. Please proceed to reception or contact HR.", key=f"vis_{zone_key}", cooldown_secs=15.0)

                                    # 2. Unregistered Face Log for HR Kiosk
                                    if camera_role in ['FaceRecognition', 'Hybrid']:
                                        send_webhook_punch(unregistered_webhook_url, {
                                            'deviceId': device_id,
                                            'photoBase64': f"data:image/jpeg;base64,{crop_b64}" if crop_b64 else None,
                                            'timestamp': time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(now)),
                                            'zoneGroup': zone_group
                                        })

                                    # 3. Security Intrusion Alert for NVR Surveillance
                                    if camera_role in ['SecuritySurveillance', 'RestrictedArea', 'Hybrid'] or security_monitoring.get('alertUnrecognizedFaces', True):
                                        sev = 'Critical' if camera_role == 'RestrictedArea' else 'Medium'
                                        tit = f'RESTRICTED AREA INTRUSION in {zone_group}' if camera_role == 'RestrictedArea' else f'Unidentified Individual in {zone_group}'
                                        desc = f'Unrecognized person detected by CCTV camera in {zone_group}. Security review recommended.'
                                        send_webhook_punch(security_alert_url, {
                                            'deviceId': device_id,
                                            'eventType': 'StrangerIntrusion',
                                            'title': tit,
                                            'description': desc,
                                            'severity': sev,
                                            'photoBase64': f"data:image/jpeg;base64,{crop_b64}" if crop_b64 else None,
                                            'timestamp': time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(now))
                                        })

                            box_color = (0, 0, 255) if camera_role == 'RestrictedArea' else (0, 165, 255)
                            box_text = "RESTRICTED" if camera_role == 'RestrictedArea' else "VISITOR"
                            new_boxes.append({
                                'box': (orig_left, orig_top, orig_right, orig_bottom),
                                'label': box_text,
                                'color': box_color,
                                'expires': now + 1.6
                            })

                    if new_boxes:
                        active_boxes = new_boxes

            # Clean expired bounding boxes
            active_boxes = [b for b in active_boxes if b['expires'] > now]

            # Draw active boxes onto frame for real-time visualization
            for b_info in active_boxes:
                l, t, r, b = b_info['box']
                col = b_info['color']
                cv2.rectangle(frame, (l, t), (r, b), col, 2)
                cv2.putText(frame, b_info['label'], (l, max(20, t - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, col, 2)

            # Draw OSD Overlays (Role, Zone, Punch & Visitor Counters, Timestamp)
            timestamp_str = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(now))
            cv2.putText(frame, f"ROLE: {camera_role.upper()} | ZONE: {zone_group} | {timestamp_str}", (15, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
            cv2.putText(frame, f"PUNCHES: {worker_info['total_punches']} | VISITORS: {worker_info['visitor_count']}", (15, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (0, 255, 200), 2)

            # Encode latest frame to JPEG on EVERY frame for smooth 20+ FPS live stream
            _, jpeg_buf = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
            worker_info['latest_frame_bytes'] = jpeg_buf.tobytes()
            worker_info['latest_frame_time'] = now

            time.sleep(0.01)

        except Exception as loop_err:
            print(f"[IP-Camera Worker Exception] Device {device_id}: {loop_err}")
            worker_info['status'] = 'error'
            worker_info['error_message'] = str(loop_err)
            time.sleep(1.5)

    if cap is not None:
        try:
            cap.release()
        except Exception:
            pass
    worker_info['status'] = 'stopped'
    print(f"[IP-Camera Worker] Worker thread stopped for Device {device_id}")

# -------------------------------------------------------------
# Core API Endpoints
# -------------------------------------------------------------
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "service": "face_recognition",
        "cached_count": len(face_cache),
        "active_cameras": len([w for w in camera_workers.values() if w.get('status') == 'running']),
        "opencv_available": cv2 is not None
    }), 200

@app.route('/sync-cache', methods=['POST'])
def sync_cache():
    try:
        data = request.json or {}
        employees = data.get('employees', [])
        
        synced_count = 0
        skipped_count = 0
        
        for emp in employees:
            emp_id = emp.get('employeeId')
            photo_path = emp.get('profilePhoto')
            
            if not emp_id or not photo_path:
                skipped_count += 1
                continue
                
            abs_path = get_absolute_path(photo_path)
            if not os.path.exists(abs_path):
                skipped_count += 1
                continue
                
            try:
                img_pil = Image.open(abs_path)
                encodings = extract_face_encodings(img_pil)
                if encodings:
                    face_cache[emp_id] = encodings[0].tolist()
                    face_name = emp.get('firstName') or emp.get('name') or emp_id
                    face_cache_names[emp_id] = face_name
                    synced_count += 1
                else:
                    skipped_count += 1
            except Exception as e:
                skipped_count += 1
                
        return jsonify({
            "success": True, 
            "message": f"Cache sync complete. Synced: {synced_count}, Skipped: {skipped_count}",
            "cached_total": len(face_cache)
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/test-voice', methods=['POST'])
def test_voice():
    try:
        data = request.json or {}
        text = data.get('text', 'Hello, voice response system is active and operational.')
        speak_voice_response(text, key=None, cooldown_secs=0)
        return jsonify({"success": True, "message": f"Voice announcement queued: {text}"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/match-face', methods=['POST'])
def match_face():
    try:
        data = request.json or {}
        face_base64 = data.get('faceImageBase64')
        candidates_input = data.get('candidates', []) # Array of dicts with employeeId and profilePhoto
        
        if not face_base64:
            return jsonify({"success": False, "message": "No face image provided"}), 400
            
        # Decode webcam capture
        try:
            if face_base64.startswith("data:image") or ";base64," in face_base64:
                header, base64_data = face_base64.split(";base64,")
                webcam_bytes = base64.b64decode(base64_data)
            else:
                webcam_bytes = base64.b64decode(face_base64)
            img_pil = Image.open(BytesIO(webcam_bytes))
            webcam_encodings = extract_face_encodings(img_pil)
        except Exception as img_err:
            return jsonify({"success": False, "message": f"Error decoding image: {str(img_err)}"}), 400
            
        if not webcam_encodings:
            return jsonify({
                "success": False, 
                "faceDetected": False, 
                "message": "No face detected in captured image"
            }), 400
            
        webcam_encoding = webcam_encodings[0]
        
        # Load and compute candidate encodings on demand
        candidates_to_compare = []
        candidate_encodings = []
        
        for cand in candidates_input:
            emp_id = cand.get('employeeId')
            photo_path = cand.get('profilePhoto')
            
            if not emp_id or not photo_path:
                continue
                
            # If not in cache, load and compute it
            if emp_id not in face_cache:
                abs_path = get_absolute_path(photo_path)
                if os.path.exists(abs_path):
                    try:
                        img_pil_cand = Image.open(abs_path)
                        encs = extract_face_encodings(img_pil_cand)
                        if encs:
                            face_cache[emp_id] = encs[0].tolist()
                    except Exception as cand_err:
                        print(f"Error computing encoding for {emp_id}: {str(cand_err)}")
                        
            # If successfully cached, add to comparison list
            if emp_id in face_cache:
                candidates_to_compare.append(emp_id)
                candidate_encodings.append(np.array(face_cache[emp_id]))
                
        if not candidate_encodings:
            return jsonify({
                "success": False, 
                "faceDetected": True, 
                "message": "No registered candidate photos available for comparison."
            }), 400
            
        # Compare captured face with candidate encodings
        with recognition_lock:
            distances = face_recognition.face_distance(candidate_encodings, webcam_encoding)
        
        valid_matches = []
        for i, dist in enumerate(distances):
            dist_val = float(dist)
            match_score = calculate_score(dist_val)
            is_match = bool(dist_val <= 0.48 and match_score >= 70.0)
            
            valid_matches.append({
                "employeeId": candidates_to_compare[i],
                "matched": is_match,
                "score": match_score,
                "distance": round(dist_val, 4)
            })
            
        valid_matches = [m for m in valid_matches if m['matched']]
        
        if not valid_matches:
            return jsonify({
                "success": False, 
                "faceDetected": True, 
                "message": "Face not recognized. Please adjust your face or try again."
            }), 400
            
        valid_matches.sort(key=lambda x: x['score'], reverse=True)
        best_match = valid_matches[0]
        
        return jsonify({
            "success": True, 
            "faceDetected": True, 
            "employeeId": best_match['employeeId'],
            "score": best_match['score'],
            "distance": best_match['distance']
        })
        
    except Exception as e:
        return jsonify({"success": False, "faceDetected": False, "message": str(e)}), 500

# -------------------------------------------------------------
# IP Camera Management Endpoints
# -------------------------------------------------------------
@app.route('/ip-camera/test-stream', methods=['POST'])
def test_stream():
    """
    Test connectivity to an RTSP or HTTP video stream and return a sample snapshot
    """
    if cv2 is None:
        return jsonify({"success": False, "message": "OpenCV cv2 library not installed on server"}), 500

    try:
        data = request.json or {}
        stream_url = data.get('streamUrl')
        if not stream_url:
            return jsonify({"success": False, "message": "streamUrl is required"}), 400

        cap = open_video_stream(stream_url)
        if cap is None or not cap.isOpened():
            return jsonify({"success": False, "message": "Unable to connect to RTSP/HTTP stream URL"}), 400

        ret, frame = cap.read()
        cap.release()

        if not ret or frame is None:
            return jsonify({"success": False, "message": "Connected but failed to grab test frame"}), 400

        h, w = frame.shape[:2]
        if w > 800:
            frame = cv2.resize(frame, (800, int(h * 800 / w)))
            h, w = frame.shape[:2]

        _, buf = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        b64_str = base64.b64encode(buf).decode('utf-8')

        return jsonify({
            "success": True,
            "message": "Stream connected successfully",
            "width": w,
            "height": h,
            "frameBase64": f"data:image/jpeg;base64,{b64_str}"
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/ip-camera/start-stream', methods=['POST'])
def start_stream():
    """
    Launch or update a background recognition thread for a registered IP Camera
    """
    try:
        data = request.json or {}
        device_id = str(data.get('deviceId'))
        stream_url = data.get('streamUrl')
        location_id = str(data.get('locationId', ''))
        zone_group = data.get('zoneGroup', 'Main Area')
        direction = data.get('direction', 'auto')
        camera_role = data.get('cameraRole', 'FaceRecognition')
        security_monitoring = data.get('securityMonitoring') or {}
        cooldown_mins = float(data.get('cooldownMinutes', 5))
        node_webhook_url = data.get('nodeWebhookUrl', 'http://127.0.0.1:5000/api/devices/ip-camera-punch')
        unregistered_webhook_url = data.get('unregisteredWebhookUrl', 'http://127.0.0.1:5000/api/devices/unregistered-face-log')
        security_alert_webhook_url = data.get('securityAlertWebhookUrl', 'http://127.0.0.1:5000/api/nvr/alerts/webhook')

        if not device_id or not stream_url:
            return jsonify({"success": False, "message": "deviceId and streamUrl are required"}), 400

        # Stop existing worker for this device if running
        if device_id in camera_workers:
            old_worker = camera_workers[device_id]
            old_worker['stop_event'].set()
            if old_worker.get('thread') and old_worker['thread'].is_alive():
                old_worker['thread'].join(timeout=2.0)

        stop_event = threading.Event()
        worker_info = {
            'device_id': device_id,
            'stream_url': stream_url,
            'location_id': location_id,
            'zone_group': zone_group,
            'direction': direction,
            'camera_role': camera_role,
            'security_monitoring': security_monitoring,
            'cooldown_seconds': cooldown_mins * 60.0,
            'recording_schedule_enabled': bool(data.get('recordingScheduleEnabled')),
            'recording_schedule_start': data.get('recordingScheduleStart', '09:00'),
            'recording_schedule_duration': float(data.get('recordingScheduleDuration', 8)),
            'node_webhook_url': node_webhook_url,
            'unregistered_webhook_url': unregistered_webhook_url,
            'security_alert_webhook_url': security_alert_webhook_url,
            'stop_event': stop_event,
            'status': 'starting',
            'error_message': None,
            'latest_frame_bytes': None,
            'latest_frame_time': 0,
            'total_punches': 0,
            'last_punch': None,
            'visitor_count': 0,
            'last_visitor_time': None,
            'is_recording': False,
            'video_writer': None
        }

        t = threading.Thread(target=camera_stream_worker_loop, args=(worker_info,), daemon=True)
        worker_info['thread'] = t
        camera_workers[device_id] = worker_info
        t.start()

        return jsonify({
            "success": True,
            "message": f"IP Camera stream recognition worker started for Device {device_id}",
            "status": "running"
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/ip-camera/broadcast', methods=['POST'])
def handle_ip_camera_broadcast():
    """
    Broadcast audio announcement, push-to-talk voice, or security siren to camera speakers
    """
    try:
        data = request.json or {}
        device_id = str(data.get('deviceId', 'all'))
        cue = data.get('cue', 'normal')  # 'normal' | 'siren' | 'warning' | 'restricted' | 'welcome'
        msg = data.get('message', '').strip()
        audio_b64 = data.get('audioBase64')

        if cue == 'siren':
            play_siren_alarm(duration_seconds=3.5)
            if msg:
                time.sleep(0.5)
                speak_voice_response(msg, key=None, cooldown_secs=0)
            return jsonify({"success": True, "message": "Emergency security siren alert activated"})

        elif cue == 'warning':
            play_siren_alarm(duration_seconds=1.0)
            text = msg or "Warning! Security alert in progress. Please clear the area."
            speak_voice_response(text, key=None, cooldown_secs=0)
            return jsonify({"success": True, "message": f"Security warning broadcast dispatched: {text}"})

        elif cue == 'restricted':
            play_siren_alarm(duration_seconds=1.2)
            text = msg or "Attention! You have entered a restricted surveillance area. Authorization is required."
            speak_voice_response(text, key=None, cooldown_secs=0)
            return jsonify({"success": True, "message": f"Restricted area warning broadcast: {text}"})

        elif cue == 'welcome':
            text = msg or "Welcome to the facility. Please proceed to the visitor desk for registration."
            speak_voice_response(text, key=None, cooldown_secs=0)
            return jsonify({"success": True, "message": f"Welcome announcement broadcast: {text}"})

        elif audio_b64:
            # Decode custom microphone WAV/audio and play via system sound
            try:
                import winsound
                audio_clean = audio_b64.split(";base64,")[-1].strip()
                audio_bytes = base64.b64decode(audio_clean)
                uploads_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
                os.makedirs(uploads_dir, exist_ok=True)
                temp_audio_path = os.path.join(uploads_dir, f"broadcast_{int(time.time())}.wav")
                with open(temp_audio_path, 'wb') as f:
                    f.write(audio_bytes)
                winsound.PlaySound(temp_audio_path, winsound.SND_FILENAME | winsound.SND_ASYNC)
                return jsonify({"success": True, "message": "Voice audio broadcast transmitted to camera speaker"})
            except Exception as sound_err:
                if msg:
                    speak_voice_response(msg, key=None, cooldown_secs=0)
                    return jsonify({"success": True, "message": f"Microphone audio fallback to TTS: {msg}"})
                return jsonify({"success": False, "message": f"Error playing broadcast audio: {str(sound_err)}"}), 500

        else:
            if msg:
                speak_voice_response(msg, key=None, cooldown_secs=0)
                return jsonify({"success": True, "message": f"Intercom TTS announcement broadcast: {msg}"})
            else:
                return jsonify({"success": False, "message": "No announcement message or audio provided for broadcast"}), 400

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/ip-camera/stop-stream', methods=['POST'])
def stop_stream():
    """
    Stop the background recognition thread for a registered IP Camera
    """
    try:
        data = request.json or {}
        device_id = str(data.get('deviceId'))
        if not device_id or device_id not in camera_workers:
            return jsonify({"success": True, "message": "Stream not active or already stopped"}), 200

        worker = camera_workers[device_id]
        if worker.get('is_recording'):
            try:
                stop_camera_recording(device_id)
            except Exception:
                pass

        worker['stop_event'].set()
        if worker.get('thread') and worker['thread'].is_alive():
            worker['thread'].join(timeout=2.0)
        worker['status'] = 'stopped'

        return jsonify({"success": True, "message": f"Stream worker stopped for Device {device_id}"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/ip-camera/start-recording', methods=['POST'])
def handle_start_recording():
    """
    Manually start video surveillance recording for a camera
    """
    try:
        data = request.json or {}
        device_id = str(data.get('deviceId'))
        recording_type = data.get('recordingType', 'Manual')
        recording_id = data.get('recordingId')
        if not device_id:
            return jsonify({"success": False, "message": "deviceId is required"}), 400
        
        res = start_camera_recording(device_id, recording_type=recording_type, recording_id=recording_id)
        status_code = 200 if res.get('success') else 400
        return jsonify(res), status_code
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/ip-camera/stop-recording', methods=['POST'])
def handle_stop_recording():
    """
    Stop video surveillance recording and finalize MP4 file
    """
    try:
        data = request.json or {}
        device_id = str(data.get('deviceId'))
        if not device_id:
            return jsonify({"success": False, "message": "deviceId is required"}), 400
        
        res = stop_camera_recording(device_id)
        status_code = 200 if res.get('success') else 400
        return jsonify(res), status_code
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/ip-camera/status/<device_id>', methods=['GET'])
def camera_status(device_id):
    """
    Get live worker health, resolution, diagnostic stats, and detection metrics for an IP Camera
    """
    worker = camera_workers.get(str(device_id))
    if not worker:
        return jsonify({
            "success": True,
            "isRunning": False,
            "status": "idle",
            "error": None,
            "width": 0,
            "height": 0,
            "resolution": {"width": 0, "height": 0},
            "lastFrameAgo": None,
            "isRecording": False,
            "recordingType": "Manual",
            "recordingElapsedSecs": 0,
            "totalPunches": 0,
            "visitorCount": 0,
            "lastPunch": None
        })

    now = time.time()
    last_frame_time = worker.get('last_frame_time', 0)
    last_frame_ago = round(now - last_frame_time, 1) if last_frame_time > 0 else None
    
    is_rec = worker.get('is_recording', False)
    rec_start = worker.get('recording_start_time', 0)
    rec_elapsed = int(now - rec_start) if (is_rec and rec_start > 0) else 0

    return jsonify({
        "success": True,
        "isRunning": worker.get('status') == 'running',
        "status": worker.get('status', 'idle'),
        "error": worker.get('error_message'),
        "width": worker.get('width', 0),
        "height": worker.get('height', 0),
        "resolution": worker.get('resolution', {'width': worker.get('width', 0), 'height': worker.get('height', 0)}),
        "lastFrameAgo": last_frame_ago,
        "isRecording": is_rec,
        "recordingType": worker.get('recording_type', 'Manual'),
        "recordingElapsedSecs": rec_elapsed,
        "totalPunches": worker.get('total_punches', 0),
        "visitorCount": worker.get('visitor_count', 0),
        "lastPunch": worker.get('last_punch'),
        "lastVisitorTime": worker.get('last_visitor_time'),
        "zoneGroup": worker.get('zone_group'),
        "direction": worker.get('direction')
    })

@app.route('/ip-camera/snapshot/<device_id>', methods=['GET'])
def camera_snapshot(device_id):
    """
    Get the latest annotated snapshot frame for an IP Camera
    """
    worker = camera_workers.get(str(device_id))
    if not worker or not worker.get('latest_frame_bytes'):
        return jsonify({"success": False, "message": "No live camera frame available"}), 404

    return Response(worker['latest_frame_bytes'], mimetype='image/jpeg')

@app.route('/ip-camera/mjpeg/<device_id>', methods=['GET'])
def camera_mjpeg(device_id):
    """
    Live multipart MJPEG stream for real-time video display in HTML <img> tags
    """
    def generate_mjpeg():
        last_sent_time = 0.0
        while True:
            worker = camera_workers.get(str(device_id))
            if not worker or worker.get('status') == 'stopped':
                break
            frame_bytes = worker.get('latest_frame_bytes')
            frame_time = worker.get('latest_frame_time', 0.0)
            if frame_bytes and frame_time != last_sent_time:
                last_sent_time = frame_time
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            time.sleep(0.035)

    return Response(generate_mjpeg(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/ip-camera/zones', methods=['GET'])
def list_zones():
    """
    List all active camera zones and current cooldown entries
    """
    with cooldown_lock:
        return jsonify({
            "success": True,
            "zones": list(zone_cooldowns.keys()),
            "cooldownEntries": {k: len(v) for k, v in zone_cooldowns.items()}
        })

if __name__ == '__main__':
    # Run Flask daemon on port 5001 locally with threaded worker support
    print("Starting face recognition microservice on port 5001...")
    app.run(host='127.0.0.1', port=5001, debug=False, threaded=True)
