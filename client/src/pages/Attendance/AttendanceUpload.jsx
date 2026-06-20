import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bulkUploadAttendance } from '../../api/attendanceApi';
import toast from 'react-hot-toast';

export default function AttendanceUpload() {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [results, setResults] = useState(null);
    const navigate = useNavigate();

    const handleFileChange = (e) => {
        if (e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setResults(null); // Reset previous results if uploading a new file
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) {
            toast.error('Please select an Excel file');
            return;
        }

        const formData = new FormData();
        formData.append('excelFile', file);

        try {
            setUploading(true);
            const res = await bulkUploadAttendance(formData);

            setResults({
                success: true,
                message: res.message,
                errors: res.errors || []
            });

            toast.success('Upload processed successfully');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to upload attendance');
            setResults({
                success: false,
                message: error.response?.data?.message || 'Upload failed',
                errors: []
            });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="attendance-upload-page" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Bulk Upload Attendance</h1>
                    <p className="page-subtitle">Import timesheet data from biometric systems</p>
                </div>
                <button onClick={() => navigate('/attendance')} className="btn btn-secondary">Back to Dashboard</button>
            </div>

            <div className="card" style={{ marginBottom: '2rem' }}>
                <div style={{ padding: '1.5rem', background: 'var(--bg-tertiary)', borderRadius: '8px', marginBottom: '2rem', borderLeft: '4px solid var(--primary-color)' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Excel Format Requirements</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        Your uploaded `.xlsx` file must contain the following exact column headers in the first row.
                        Dates should be formatted natively in Excel or as `YYYY-MM-DD`. Times should be formatted as `HH:mm`.
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                        <span className="badge" style={{ background: 'var(--bg-primary)' }}>Employee ID</span>
                        <span className="badge" style={{ background: 'var(--bg-primary)' }}>Date</span>
                        <span className="badge" style={{ background: 'var(--bg-primary)' }}>Check In</span>
                        <span className="badge" style={{ background: 'var(--bg-primary)' }}>Check Out</span>
                        <span className="badge" style={{ background: '#6366f1', color: 'white' }}>Action (optional)</span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                        💡 <strong>Modify:</strong> Re-upload rows with updated times to overwrite existing records.
                        &nbsp;|&nbsp; <strong>Delete:</strong> Set the <code>Action</code> column to <code>DELETE</code> to remove records. Frozen payroll months are protected.
                    </p>
                </div>

                <form onSubmit={handleUpload}>
                    <div className="form-group" style={{
                        border: '2px dashed var(--border-color)',
                        padding: '3rem 2rem',
                        textAlign: 'center',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        background: file ? 'var(--bg-tertiary)' : 'transparent',
                        transition: 'all 0.2s'
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: '0.5' }}>📊</div>
                        <label style={{ display: 'block', cursor: 'pointer' }}>
                            <span style={{ fontSize: '1.2rem', fontWeight: '500', color: 'var(--primary-color)' }}>
                                {file ? file.name : 'Click to select Excel file'}
                            </span>
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                            />
                        </label>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                            Supports .xlsx and .xls formats
                        </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                        <button type="submit" className="btn btn-primary" disabled={!file || uploading}>
                            {uploading ? 'Processing...' : 'Upload & Process'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Results Section */}
            {results && (
                <div className={`card ${results.success ? '' : 'border-danger'}`} style={{ border: !results.success ? '1px solid #ef4444' : undefined }}>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: results.success ? '#10b981' : '#ef4444' }}>
                        {results.success ? '✅ Processing Complete' : '❌ Processing Failed'}
                    </h3>
                    <p style={{ fontWeight: '500', marginBottom: '1rem' }}>{results.message}</p>

                    {results.errors && results.errors.length > 0 && (
                        <div>
                            <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#f59e0b' }}>⚠️ Warnings / Skipped Rows ({results.errors.length})</h4>
                            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                                    {results.errors.map((err, idx) => (
                                        <li key={idx} style={{ marginBottom: '0.25rem' }}>{err}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {results.success && (
                        <div style={{ marginTop: '1.5rem' }}>
                            <button onClick={() => navigate('/attendance')} className="btn btn-primary">View in Dashboard</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
