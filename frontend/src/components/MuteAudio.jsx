import React, { useState, useRef, useEffect } from 'react';
import Hls from 'hls.js';
import './MuteForm.css';

const AudioMuteForm = () => {
    const [ranges, setRanges] = useState([{ start: '', end: '' }]);
    const [mutedAudioUrl, setMutedAudioUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const originalAudioRef = useRef();
    const mutedAudioRef = useRef();

    const localM3U8Path = '/output_hls/playlist.m3u8';

    useEffect(() => {
        if (originalAudioRef.current) {
            if (Hls.isSupported()) {
                const hls = new Hls();
                hls.loadSource(localM3U8Path);
                hls.attachMedia(originalAudioRef.current);
            } else if (originalAudioRef.current.canPlayType('application/vnd.apple.mpegurl')) {
                originalAudioRef.current.src = localM3U8Path;
            }
        }
    }, []);

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

        const numericRanges = ranges.map(r => ({
            start: parseFloat(r.start),
            end: parseFloat(r.end),
        }));

        numericRanges.sort((a, b) => a.start - b.start);

        for (let i = 1; i < numericRanges.length; i++) {
            if (numericRanges[i].start < numericRanges[i - 1].end) {
                alert("Timestamp ranges must not overlap.");
                return;
            }
        }

        for (const r of numericRanges) {
            if (isNaN(r.start) || isNaN(r.end) || r.start >= r.end) {
                alert("Invalid timestamp range provided.");
                return;
            }
        }

        try {
            setIsLoading(true);
            const formData = new FormData();
            formData.append('ranges', JSON.stringify(numericRanges));

            const response = await fetch('http://localhost:5000/mute-audio', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (data.mutedUrl) {
                setMutedAudioUrl(data.mutedUrl); // ✅ Use backend URL
            } else {
                alert('No muted audio URL received from server.');
            }
        } catch (error) {
            console.error('Error muting audio:', error);
            alert('Error muting audio.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (mutedAudioUrl && mutedAudioRef.current) {
            if (Hls.isSupported()) {
                const hls = new Hls();
                hls.loadSource(mutedAudioUrl);
                hls.attachMedia(mutedAudioRef.current);
            } else if (mutedAudioRef.current.canPlayType('application/vnd.apple.mpegurl')) {
                mutedAudioRef.current.src = mutedAudioUrl;
            }
        }
    }, [mutedAudioUrl]);

    return (
        <div className="audio-muter-container">
            <h1 className="audio-muter-title">Audio Muter</h1>

            <div className="audio-player-container">
                <h3>Original Audio (.m3u8)</h3>
                <audio ref={originalAudioRef} controls />
            </div>

            <form onSubmit={handleSubmit}>
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
                    <button type="submit" disabled={isLoading}>
                        {isLoading ? 'Processing...' : 'Mute Audio'}
                    </button>
                </div>
            </form>

            {mutedAudioUrl && (
                <div className="audio-player-container">
                    <h3>Muted Audio (.m3u8)</h3>
                    <audio ref={mutedAudioRef} controls />
                </div>
            )}
        </div>
    );
};

export default AudioMuteForm;
