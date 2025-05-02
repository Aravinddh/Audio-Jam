import React, { useState, useRef } from 'react';
import './MuteForm.css';

const AudioMuteForm = () => {
    const [file, setFile] = useState(null);
    const [audioUrl, setAudioUrl] = useState('');
    const [ranges, setRanges] = useState([{ start: '', end: '' }]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [url, setUrl] = useState('');
    const [extractedAudioUrl, setExtractedAudioUrl] = useState(''); // New state for extracted audio
    const [isFileInput, setIsFileInput] = useState(false); // Boolean to track file input state
    const [isUrlInput, setIsUrlInput] = useState(false); // Boolean to track URL input state
    const fileInputRef = useRef();
    const [ismuted, setIsMuted] = useState(false);
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const blobUrl = URL.createObjectURL(file);
            setSelectedFile(file);
            setAudioUrl(blobUrl); // Directly set the audio URL for file
            setIsFileInput(true);
            setIsUrlInput(false); // Reset URL input state
            setUrl('');  // Clear any URL input
        }
    };

    const handleUrlChange = (e) => {
        setUrl(e.target.value);
        setIsUrlInput(true); // Set URL input state to true
        setIsFileInput(false); // Reset file input state
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
        setAudioUrl('');
        setIsFileInput(false);
        fileInputRef.current.value = ''; // Clear file input value
    };

    const handleRangeChange = (index, field, value) => {
        const updatedRanges = [...ranges];
        updatedRanges[index][field] = value;
        setRanges(updatedRanges);
    };

    const addRange = () => {
        setRanges([...ranges, { start: '', end: '' }]);
    };

    const removeRange = (index) => {
        const updatedRanges = ranges.filter((_, i) => i !== index);
        setRanges(updatedRanges);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Convert to numbers
        const numericRanges = ranges.map(r => ({
            start: parseFloat(r.start),
            end: parseFloat(r.end),
        }));

        // Sort by start time
        numericRanges.sort((a, b) => a.start - b.start);

        // Check for overlaps
        for (let i = 1; i < numericRanges.length; i++) {
            if (numericRanges[i].start < numericRanges[i - 1].end) {
                alert("Timestamp ranges must not overlap.");
                return;
            }
        }

        // Optionally, validate each range
        for (const r of numericRanges) {
            if (isNaN(r.start) || isNaN(r.end) || r.start >= r.end) {
                alert("Invalid timestamp range provided.");
                return;
            }
        }

        const formData = new FormData();
        formData.append('ranges', JSON.stringify(numericRanges));

        if (url) {
            // Send m3u8 URL and mute ranges
            formData.append('fromM3u8', url);
        } else if (selectedFile) {
            // Send file and mute ranges
            formData.append('file', selectedFile);
        } else {
            alert("Please provide either an MP3 file or a .m3u8 URL.");
            return;
        }

        try {
            const response = await fetch('http://localhost:5000/mute-audio', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            setAudioUrl(`http://localhost:5000${data.mutedUrl}`); // Set muted audio URL
            setIsMuted(true)
        } catch (error) {
            console.error('Error muting audio:', error);
        }
    };

    // New function to extract audio from .m3u8 URL
    const handleExtractAudio = async () => {
        if (!url) {
            alert('Please provide an .m3u8 URL.');
            return;
        }

        try {
            const response = await fetch('http://localhost:5000/extract-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ m3u8Url: url }),
            });

            const data = await response.json();
            setExtractedAudioUrl(`http://localhost:5000${data.audioUrl}`); // Set the extracted audio URL
        } catch (error) {
            console.error('Error extracting audio:', error);
        }
    };

    return (
        <div>
            <h1 className="audio-muter-title">Audio Muter</h1>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>Upload MP3 File:</label>
                    <input
                        type="file"
                        accept=".mp3"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        disabled={isUrlInput} // Disable if URL input is active
                    />
                    {selectedFile && (
                        <div style={{ marginTop: '8px' }}>
                            <button
                                type="button"
                                onClick={handleRemoveFile}
                                style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#f44336',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Remove File
                            </button>
                        </div>
                    )}
                </div>

                <div>
                    <label>Or, Provide .m3u8 URL:</label>
                    <input
                        type="url"
                        value={url}
                        onChange={handleUrlChange}
                        disabled={isFileInput} // Disable if file input is active
                    />
                </div>

                <div>
                    <label>Timestamp Ranges to Mute:</label>
                    {ranges.map((range, index) => (
                        <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <input
                                type="number"
                                placeholder="Start"
                                value={range.start}
                                onChange={(e) => handleRangeChange(index, 'start', e.target.value)}
                            />
                            <input
                                type="number"
                                placeholder="End"
                                value={range.end}
                                onChange={(e) => handleRangeChange(index, 'end', e.target.value)}
                            />
                            <button type="button" onClick={() => removeRange(index)}>Remove</button>
                        </div>
                    ))}
                    <button type="button" onClick={addRange}>+ Add Range</button>
                </div>
                <div className='form-buttons'>
                    <button type="button" onClick={handleExtractAudio} disabled={isFileInput}>
                        Extract Audio
                    </button>
                    <button type="submit">Mute Audio</button>
                </div>
            </form>

            {/* New Button for Extracting Audio */}


            {/* Display the original audio file immediately */}
            {isFileInput && !audioUrl && (
                <div className="audio-player-container">
                    <h3>Original Audio</h3>
                    <audio controls>
                        <source src={audioUrl} type="audio/mp3" />
                        Your browser does not support the audio element.
                    </audio>
                </div>
            )}

            {isFileInput && audioUrl && (
                <div className="audio-player-container">
                    <h3>Original Audio</h3>
                    <audio controls>
                        <source src={audioUrl} type="audio/mp3" />
                        Your browser does not support the audio element.
                    </audio>
                </div>
            )}

            {/* New section to show extracted audio */}
            {extractedAudioUrl && (
                <div className="audio-player-container">
                    <h3>Extracted Audio</h3>
                    <audio controls>
                        <source src={extractedAudioUrl} type="audio/mp3" />
                        Your browser does not support the audio element.
                    </audio>
                </div>
            )}

            {/* Section to show muted audio */}
            {audioUrl && extractedAudioUrl && !isFileInput && (
                <div className="audio-player-container">
                    <h3>Muted Audio</h3>
                    <audio controls>
                        <source src={audioUrl} type="audio/mp3" />
                        Your browser does not support the audio element.
                    </audio>
                </div>
            )}

            {audioUrl && !extractedAudioUrl && isFileInput && ismuted && (
                <div className="audio-player-container">
                    <h3>Muted Audio</h3>
                    <audio controls>
                        <source src={audioUrl} type="audio/mp3" />
                        Your browser does not support the audio element.
                    </audio>
                </div>
            )}
        </div>
    );
};

export default AudioMuteForm;
