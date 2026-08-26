import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import toast from 'react-hot-toast';
import * as faceapi from '@vladmandic/face-api';
import { useAuth } from '../../context/AuthContext';
import { punchInOut } from '../../api/attendanceApi';

export default function WebcamPunch({ onPunchSuccess }) {
    const { user } = useAuth();
    const webcamRef = useRef(null);
    const [imgSrc, setImgSrc] = useState(null);
    const [location, setLocation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [locationError, setLocationError] = useState(null);

    // Face Recognition States
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [referenceDescriptor, setReferenceDescriptor] = useState(null);
    const [faceSetupError, setFaceSetupError] = useState(null);

    // Initialize Face API Models & Reference Image
    useEffect(() => {
        const loadModelsAndReference = async () => {
            try {
                const MODEL_URL = '/models';
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
                ]);
                setModelsLoaded(true);

                // Ensure user has a profile photo
                if (!user?.profilePhoto) {
                    setFaceSetupError('No profile photo found. Please request HR to upload your photo to enable face matching.');
                    return;
                }

                // Load the image and extract descriptor
                const imgUrl = `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '')}${user.profilePhoto}`;

                // Fetch image as blob to avoid canvas cross-origin issues
                const imgRes = await fetch(imgUrl);
                const blob = await imgRes.blob();
                const image = await faceapi.bufferToImage(blob);

                const detection = await faceapi.detectSingleFace(image).withFaceLandmarks().withFaceDescriptor();

                if (detection) {
                    setReferenceDescriptor(detection.descriptor);
                } else {
                    setFaceSetupError('Could not detect a clear face in your profile photo. Please ask HR to upload a clearer photo.');
                }

            } catch (err) {
                console.error("Face API setup error:", err);
                setFaceSetupError('Failed to load Face AI models.');
            }
        };

        if (user) {
            loadModelsAndReference();
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

            // Perform Face Recognition if setup holds
            let faceMatchScore = 1.0;
            let faceMatchFailed = false;

            if (referenceDescriptor) {
                toast('Analyzing face... please wait', { icon: '🤖' });
                try {
                    // Quick sleep to let UI update
                    await new Promise(res => setTimeout(res, 100));

                    // Use the fetched image blob to create an HTMLImageElement for faceapi
                    const imgEl = await faceapi.bufferToImage(blob);
                    const detection = await faceapi.detectSingleFace(imgEl).withFaceLandmarks().withFaceDescriptor();

                    if (!detection) {
                        toast.error('Warning: Could not detect a face in the captured photo.');
                        faceMatchFailed = true;
                    } else {
                        // Calculate Euclidean distance (lower is better, typically < 0.55 is a match)
                        const distance = faceapi.euclideanDistance(referenceDescriptor, detection.descriptor);
                        faceMatchScore = distance;

                        if (distance > 0.55) {
                            toast.error(`Warning: Face match confidence is low (Score: ${distance.toFixed(2)}). Your punch has been flagged for review.`);
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
                toast.error('Reference face descriptor missing. Flagging punch for manual review.');
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

            {!modelsLoaded && !faceSetupError && (
                <div style={{ padding: '0.5rem', margin: '1rem 0', color: 'var(--primary-color)', fontWeight: '500' }}>
                    Loading AI Face Recognition Models... 🤖
                </div>
            )}

            {faceSetupError && (
                <div style={{ background: '#fef2f2', color: '#ef4444', padding: '0.5rem', borderRadius: '4px', margin: '1rem 0', fontSize: '0.9rem' }}>
                    ⚠️ {faceSetupError}
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
                        <button onClick={() => handlePunch('in')} className="btn btn-primary" style={{ background: '#10b981', borderColor: '#10b981' }} disabled={loading || !location || !modelsLoaded}>
                            {loading ? 'Processing...' : 'Punch In'}
                        </button>
                        <button onClick={() => handlePunch('out')} className="btn btn-primary" style={{ background: '#f59e0b', borderColor: '#f59e0b' }} disabled={loading || !location || !modelsLoaded}>
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
