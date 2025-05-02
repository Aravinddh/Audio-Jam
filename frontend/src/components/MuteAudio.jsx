import React, { useState, useRef, useEffect } from 'react';
import Hls from 'hls.js';
import './MuteForm.css';

const AudioMuteForm = () => {
    const [ranges, setRanges] = useState([{ start: '', end: '' }]);
    const [mutedAudioUrl, setMutedAudioUrl] = useState('');
    const audioRef = useRef();

    const m3u8FilePath = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

    useEffect(() => {
        if (audioRef.current) {
            if (Hls.isSupported()) {
                const hls = new Hls();
                hls.loadSource(m3u8FilePath);
                hls.attachMedia(audioRef.current);
            } else if (audioRef.current.canPlayType('application/vnd.apple.mpegurl')) {
                audioRef.current.src = m3u8FilePath;
            }
        }
    }, [m3u8FilePath]);

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
            const formData = new FormData();
            formData.append('ranges', JSON.stringify(numericRanges));

            // Append the local m3u8 file (if you support it via frontend upload)
            const response = await fetch('https://audio-jam.onrender.com/mute-audio', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            setMutedAudioUrl(`https://audio-jam.onrender.com${data.mutedUrl}`);
        } catch (error) {
            console.error('Error muting audio:', error);
        }
    };

    return (
        <div className="audio-muter-container">
            <h1 className="audio-muter-title">Audio Muter</h1>

            <div className="audio-player-container">
                <h3>Original Audio (.m3u8)</h3>
                <audio ref={audioRef} controls />
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
                    <button type="submit">Mute Audio</button>
                </div>
            </form>

            {mutedAudioUrl && (
                <div className="audio-player-container">
                    <h3>Muted Audio (.m3u8)</h3>
                    <audio ref={(ref) => {
                        if (ref && Hls.isSupported()) {
                            const hls = new Hls();
                            hls.loadSource(mutedAudioUrl);
                            hls.attachMedia(ref);
                        } else if (ref && ref.canPlayType('application/vnd.apple.mpegurl')) {
                            ref.src = mutedAudioUrl;
                        }
                    }} controls />
                </div>
            )}

        </div>
    );
};

export default AudioMuteForm;
