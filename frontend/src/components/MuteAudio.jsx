import React, { useState, useRef, useEffect } from 'react';
import Hls from 'hls.js';
import './MuteForm.css';

const AudioMuteForm = () => {
    const [ranges, setRanges] = useState([{ start: '', end: '' }]);
    const [mutedAudioUrl, setMutedAudioUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const originalAudioRef = useRef(null);
    const mutedAudioRef = useRef(null);
    const originalHlsRef = useRef(null);
    const mutedHlsRef = useRef(null);

    const API_BASE_URL = 'https://audio-jam.onrender.com';

    const originalM3U8Path = `${API_BASE_URL}/output_hls/playlist.m3u8`;

    useEffect(() => {
        if (originalAudioRef.current) {
            initializeHlsPlayer(originalAudioRef.current, originalM3U8Path, originalHlsRef);
        }

        return () => {
            if (originalHlsRef.current) {
                originalHlsRef.current.destroy();
                originalHlsRef.current = null;
            }
        };
    }, []);


    useEffect(() => {
        if (mutedAudioUrl && mutedAudioRef.current) {

            if (mutedHlsRef.current) {
                mutedHlsRef.current.destroy();
                mutedHlsRef.current = null;
            }

            const fullMutedUrl = `${API_BASE_URL}${mutedAudioUrl}`;
            console.log('Loading muted audio from:', fullMutedUrl);

            initializeHlsPlayer(mutedAudioRef.current, fullMutedUrl, mutedHlsRef);
        }

        return () => {
            if (mutedHlsRef.current) {
                mutedHlsRef.current.destroy();
                mutedHlsRef.current = null;
            }
        };
    }, [mutedAudioUrl]);

    const initializeHlsPlayer = (mediaElement, url, hlsRef) => {
        if (Hls.isSupported()) {
            const hls = new Hls({
                debug: false,
                enableWorker: true,
                lowLatencyMode: false,
                backBufferLength: 90
            });

            hls.loadSource(url);
            hls.attachMedia(mediaElement);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('HLS manifest parsed successfully');
                mediaElement.play().catch(err => {
                    console.warn('Autoplay prevented:', err);
                });
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('HLS error:', data.type, data.details, data);
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.error('Fatal network error', data);
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.error('Fatal media error', data);
                            hls.recoverMediaError();
                            break;
                        default:
                            console.error('Unrecoverable error', data);
                            hls.destroy();
                            break;
                    }
                }
            });

            hlsRef.current = hls;
        } else if (mediaElement.canPlayType('application/vnd.apple.mpegurl')) {

            console.log('Using native HLS support');
            mediaElement.src = url;
        } else {
            console.error('HLS is not supported in this browser');
            setError('HLS playback is not supported in your browser');
        }
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
        setIsLoading(true);
        setError('');


        const numericRanges = ranges.map(r => ({
            start: parseFloat(r.start),
            end: parseFloat(r.end),
        }));


        numericRanges.sort((a, b) => a.start - b.start);


        for (let i = 1; i < numericRanges.length; i++) {
            if (numericRanges[i].start < numericRanges[i - 1].end) {
                setError("Timestamp ranges must not overlap.");
                setIsLoading(false);
                return;
            }
        }

        for (const r of numericRanges) {
            if (isNaN(r.start) || isNaN(r.end) || r.start >= r.end) {
                setError("Invalid timestamp range provided.");
                setIsLoading(false);
                return;
            }
        }

        try {
            const formData = new FormData();
            formData.append('ranges', JSON.stringify(numericRanges));

            console.log('Sending ranges to server:', numericRanges);

            const response = await fetch(`${API_BASE_URL}/mute-audio`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server returned ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log('Server response:', data);

            if (data.mutedUrl) {
                setMutedAudioUrl(data.mutedUrl);
            } else {
                throw new Error('No muted URL returned from server');
            }
        } catch (error) {
            console.error('Error muting audio:', error);
            setError(`Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="audio-muter-container">
            <h1 className="audio-muter-title">Audio Muter</h1>


            <div className="audio-player-container">
                <h3>Original Audio</h3>
                <audio ref={originalAudioRef} controls />
            </div>


            <form onSubmit={handleSubmit}>
                <div className="ranges-container">
                    <label>Timestamp Ranges to Mute:</label>
                    {ranges.map((range, index) => (
                        <div key={index} className="range-input">
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                placeholder="Start (seconds)"
                                value={range.start}
                                onChange={(e) => handleRangeChange(index, 'start', e.target.value)}
                            />
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                placeholder="End (seconds)"
                                value={range.end}
                                onChange={(e) => handleRangeChange(index, 'end', e.target.value)}
                            />
                            <button
                                type="button"
                                className="remove-btn"
                                onClick={() => removeRange(index)}
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                    <button type="button" className="add-btn" onClick={addRange}>
                        + Add Range
                    </button>
                </div>

                {error && <div className="error-message">{error}</div>}

                <div className="form-buttons">
                    <button type="submit" disabled={isLoading}>
                        {isLoading ? 'Processing...' : 'Mute Audio'}
                    </button>
                </div>
            </form>

            {mutedAudioUrl && (
                <div className="audio-player-container">
                    <h3>Muted Audio</h3>
                    <audio ref={mutedAudioRef} controls />
                </div>
            )}
        </div>
    );
};

export default AudioMuteForm;