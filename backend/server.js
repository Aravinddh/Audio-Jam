const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/output', express.static(path.join(__dirname, 'output')));


const m3u8Link = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'; 

function createVolumeFilters(ranges) {
    return ranges
        .map(({ start, end }) => `volume=enable='between(t,${start},${end})':volume=0`)
        .join(',');
}


app.post('/mute-audio', async (req, res) => {
    const { ranges } = req.body;
    const parsedRanges = JSON.parse(ranges);

    const outputName = `muted_${Date.now()}`;
    const outputDir = path.join(__dirname, 'output', outputName);
    const playlistFile = `${outputName}.m3u8`;
    const playlistPath = path.join(outputDir, playlistFile);

    fs.mkdirSync(outputDir, { recursive: true });
    const filterString = createVolumeFilters(parsedRanges);

    ffmpeg(m3u8Link)
        .noVideo()
        .audioFilters(filterString)
        .audioCodec('aac')
        .format('hls')
        .outputOptions([
            '-hls_time 5',
            '-hls_list_size 0',
            `-hls_segment_filename ${path.join(outputDir, 'segment_%03d.ts')}`
        ])
        .output(playlistPath)
        .on('end', () => {
            console.log(`Muted HLS audio created: ${playlistPath}`);
            res.json({ mutedUrl: `/output/${outputName}/${playlistFile}` });
        })
        .on('error', (err) => {
            console.error('Error processing HLS mute:', err.message);
            res.status(500).send('Error muting audio.');
        })
        .run();
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
