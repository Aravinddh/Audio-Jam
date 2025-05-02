const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use('/output', express.static(path.join(__dirname, 'output')));

// ✅ Replace this with the actual path to your local HLS source
const localM3U8Path = path.join(__dirname, 'output_hls', 'playlist.m3u8');

function createVolumeFilters(ranges) {
    return ranges
        .map(({ start, end }) => `volume=enable='between(t,${start},${end})':volume=0`)
        .join(',');
}

function clearOutputDirectory() {
    const outputBase = path.join(__dirname, 'output');
    if (fs.existsSync(outputBase)) {
        fs.readdirSync(outputBase).forEach(file => {
            const filePath = path.join(outputBase, file);
            fs.rmSync(filePath, { recursive: true, force: true });
        });
    }
}

app.post('/mute-audio', multer().none(), async (req, res) => {
    const { ranges } = req.body;

    if (!ranges) {
        return res.status(400).send('No valid audio ranges provided');
    }

    let parsedRanges;
    try {
        parsedRanges = JSON.parse(ranges);
    } catch (err) {
        return res.status(400).send('Invalid JSON for ranges');
    }

    if (!fs.existsSync(localM3U8Path)) {
        return res.status(404).send('Source playlist.m3u8 not found.');
    }

    clearOutputDirectory();

    const outputName = `muted_${Date.now()}`;
    const outputDir = path.join(__dirname, 'output', outputName);
    const playlistFile = `${outputName}.m3u8`;
    const playlistPath = path.join(outputDir, playlistFile);

    fs.mkdirSync(outputDir, { recursive: true });

    const filterString = createVolumeFilters(parsedRanges);

    ffmpeg(localM3U8Path)
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

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
