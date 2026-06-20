import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { punchInOut } from '../../api/attendanceApi';

// Lazy-load face-api to prevent blocking if it fails
let faceapi = null;
const loadFaceApi = async () => {
    if (faceapi) return faceapi;
    try {
        const module = await import('@vladmandic/face-api');
        faceapi = module;
        return faceapi;
    } catch (err) {
        console.warn('face-api library could not be loaded:', err.message);
        return null;
    }
};

export default function WebcamPunch({ onPunchSuccess }) {
    const { user } = useAuth();
    const webcamRef = useRef(null);
    const [imgSrc, setImgSrc] = useState(null);
    const [location, setLocation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [locationError, setLocationError] = useState(null);

    // Face Recognition States — all optional now
    const [faceStatus, setFaceStatus] = useState('loading'); // 'loading' | 'ready' | 'unavailable' | 'no-photo'
    const [referenceDescriptor, setReferenceDescriptor] = useState(null);
    const [faceStatusMessage, setFaceStatusMessage] = useState('');

    // Initialize Face API Models & Reference Image (non-blocking)
    const initFaceRecognition = async () => {
        try {
            setFaceStatus('loading');
            setFaceStatusMessage('Loading Face AI models...');

            const api = await loadFaceApi();
            if (!api) {
                setFaceStatus('unavailable');
                setFaceStatusMessage('Face AI not available — punches will be flagged for manual review.');
                return;
            }

            // Try loading TF backend
            try {
                if (api.tf?.setBackend) {
                    await api.tf.setBackend('webgl');
                }
                if (api.tf?.ready) {
                    await api.tf.ready();
                }
            } catch (backendErr) {
                console.warn('TF backend init warning:', backendErr.message);
                // Try WASM fallback
                try {
                    if (api.tf?.setBackend) await api.tf.setBackend('wasm');
                    if (api.tf?.ready) await api.tf.ready();
                } catch {
                    // If both fail, try CPU
                    try {
                        if (api.tf?.setBackend) await api.tf.setBackend('cpu');
                        if (api.tf?.ready) await api.tf.ready();
                    } catch {
                        console.warn('All TF backends failed');
                    }
                }
            }

            const MODEL_URL = '/models';
            await Promise.all([
                api.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                api.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                api.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
            ]);

            // Check for profile photo
            if (!user?.profilePhoto) {
                setFaceStatus('no-photo');
                setFaceStatusMessage('No profile photo — face match skipped. Punches flagged for review.');
                return;
            }

            // Load reference image and extract descriptor
            const imgUrl = `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '')}${user.profilePhoto}`;
            const imgRes = await fetch(imgUrl);
            const blob = await imgRes.blob();
            const image = await api.bufferToImage(blob);

            const detection = await api.detectSingleFace(image).withFaceLandmarks().withFaceDescriptor();

            if (detection) {
                setReferenceDescriptor(detection.descriptor);
                setFaceStatus('ready');
                setFaceStatusMessage('');
            } else {
                setFaceStatus('no-photo');
                setFaceStatusMessage('Could not detect face in profile photo. Punches will be flagged for review.');
            }
        } catch (err) {
            console.error('Face recognition init error:', err);
            setFaceStatus('unavailable');
            setFaceStatusMessage('Face AI unavailable — punches will be flagged for manual review.');
        }
    };

    useEffect(() => {
        if (user) {
            initFaceRecognition();
        }
    }, [user]);

    // Request location on mount
    useEffect(() => {
        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported by your browser');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude
                });
                setLocationError(null);
            },
            (err) => {
                console.error(err);
                setLocationError('Failed to capture location. Please enable location permissions.');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }, []);

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current.getScreenshot();
        setImgSrc(imageSrc);
    }, [webcamRef, setImgSrc]);

    const retake = () => {
        setImgSrc(null);
    };

    const handlePunch = async (type) => { // 'in' or 'out'
        if (!imgSrc) return toast.error("Please capture your photo first");
        if (!location) return toast.error("Awaiting GPS coordinates. Please allow location access.");

        try {
            setLoading(true);

            // Convert base64 to Blob
            const fetchRes = await fetch(imgSrc);
            const blob = await fetchRes.blob();

            // Perform Face Recognition if available (NEVER blocks punch)
            let faceMatchScore = 1.0;
            let faceMatchFailed = false;

            if (referenceDescriptor && faceapi) {
                toast('Analyzing face... please wait', { icon: '🤖' });
                try {
                    await new Promise(res => setTimeout(res, 100));
                    const imgEl = await faceapi.bufferToImage(blob);
                    const detection = await faceapi.detectSingleFace(imgEl).withFaceLandmarks().withFaceDescriptor();

                    if (!detection) {
                        toast.error('Warning: Could not detect a face in the captured photo.');
                        faceMatchFailed = true;
                    } else {
                        const distance = faceapi.euclideanDistance(referenceDescriptor, detection.descriptor);
                        faceMatchScore = distance;

                        if (distance > 0.55) {
                            toast.error(`Warning: Face match confidence is low (Score: ${distance.toFixed(2)}). Flagged for review.`);
                            faceMatchFailed = true;
                        } else {
                            toast.success(`Face match verified (Score: ${distance.toFixed(2)})`);
                        }
                    }
                } catch (faceErr) {
                    console.error("Face match error:", faceErr);
                    faceMatchFailed = true;
                }
            } else {
                // Face matching not available — proceed normally, flag for review
                faceMatchFailed = true;
            }

            const formData = new FormData();
            formData.append('photo', blob, `punch_${type}_${Date.now()}.jpeg`);
            formData.append('type', type);
            formData.append('lat', location.lat);
            formData.append('lng', location.lng);
            formData.append('faceMatchScore', faceMatchScore);
            formData.append('faceMatchFailed', faceMatchFailed);

            await punchInOut(formData);
            toast.success(`Punched ${type === 'in' ? 'In' : 'Out'} Successfully!`);
            setImgSrc(null);
            if (onPunchSuccess) onPunchSuccess();
        } catch (error) {
            toast.error(error.response?.data?.message || `Failed to punch ${type}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '1rem' }}>Biometric Quick Punch</h3>

            {locationError && (
                <div style={{ background: '#fef2f2', color: '#ef4444', padding: '0.5rem', borderRadius: '4px', margin: '1rem 0', fontSize: '0.9rem' }}>
                    ⚠️ {locationError}
                </div>
            )}

            {!locationError && !location && (
                <div style={{ padding: '0.5rem', margin: '1rem 0', color: 'var(--text-secondary)' }}>
                    Locating GPS Device... 🛰️
                </div>
            )}

            {faceStatus === 'loading' && (
                <div style={{ padding: '0.5rem', margin: '1rem 0', color: 'var(--primary-color)', fontWeight: '500' }}>
                    Loading AI Face Recognition Models... 🤖
                </div>
            )}

            {faceStatusMessage && faceStatus !== 'loading' && (
                <div style={{
                    background: faceStatus === 'ready' ? '#f0fdf4' : '#fffbeb',
                    color: faceStatus === 'ready' ? '#10b981' : '#d97706',
                    padding: '0.5rem 1rem', borderRadius: '4px', margin: '1rem 0', fontSize: '0.85rem',
                    display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center'
                }}>
                    <span>{faceStatus === 'ready' ? '✅' : 'ℹ️'} {faceStatusMessage}</span>
                    {faceStatus === 'unavailable' && (
                        <button onClick={initFaceRecognition} className="btn btn-secondary" style={{ padding: '0.2rem 0.75rem', fontSize: '0.8rem', minWidth: 'auto' }}>🔄 Retry</button>
                    )}
                </div>
            )}

            {faceStatus === 'ready' && !faceStatusMessage && (
                <div style={{ padding: '0.3rem', margin: '0.5rem 0', color: '#10b981', fontSize: '0.85rem', fontWeight: '500' }}>
                    ✅ Face AI Ready
                </div>
            )}

            <div style={{ position: 'relative', width: '100%', maxWidth: '400px', margin: '0 auto', borderRadius: '12px', overflow: 'hidden', background: '#0f172a' }}>
                {imgSrc ? (
                    <img src={imgSrc} alt="captured" style={{ width: '100%', height: 'auto', display: 'block' }} />
                ) : (
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        videoConstraints={{ facingMode: "user" }}
                        style={{ width: '100%', height: 'auto', display: 'block' }}
                    />
                )}
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                {imgSrc ? (
                    <>
                        <button onClick={retake} className="btn btn-secondary btn-outline" disabled={loading}>Retake Photo</button>
                        <button onClick={() => handlePunch('in')} className="btn btn-primary" style={{ background: '#10b981', borderColor: '#10b981' }} disabled={loading || !location}>
                            {loading ? 'Processing...' : 'Punch In'}
                        </button>
                        <button onClick={() => handlePunch('out')} className="btn btn-primary" style={{ background: '#f59e0b', borderColor: '#f59e0b' }} disabled={loading || !location}>
                            {loading ? 'Processing...' : 'Punch Out'}
                        </button>
                    </>
                ) : (
                    <button onClick={capture} className="btn btn-primary">Capture Photo to Punch</button>
                )}
            </div>

            {location && (
                <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Verified Location: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                </div>
            )}
        </div>
    );
}
