const express = require('express');
const multer = require('multer');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT|| 5000;

app.use(cors());
app.use(express.json());
app.use('/output', express.static(path.join(__dirname, 'output')));

// Setup Multer
const upload = multer({ dest: 'uploads/' });

// Utility to generate unique output filenames
const generateOutputName = (prefix = 'muted') => `${prefix}_${Date.now()}.mp3`;

// Store the extracted audio filename globally
let extractedAudioFileName = '';

// Function to create volume filters for mute ranges
function createVolumeFilters(ranges) {
    return ranges
        .map(({ start, end }) => `volume=enable='between(t,${start},${end})':volume=0`)
        .join(',');
}

const cleanOutputFolder = () => {
    const outputDir = path.join(__dirname, 'output');
    fs.readdir(outputDir, (err, files) => {
        if (err) {
            console.error('Error reading output folder:', err);
            return;
        }
        files.forEach((file) => {
            const filePath = path.join(outputDir, file);
            fs.unlink(filePath, (err) => {
                if (err) console.error(`Error deleting file: ${filePath}`, err);
                else console.log(`Deleted old file: ${filePath}`);
            });
        });
    });
};
// Run cleanup at server start
cleanOutputFolder();

// 🔧 Extract audio from m3u8 (already working)
app.post('/extract-audio', async (req, res) => {
    const { m3u8Url } = req.body;
    extractedAudioFileName = generateOutputName('extracted'); // Store the filename globally
    const outputPath = path.join(__dirname, 'output', extractedAudioFileName);

    console.log(`Starting extraction from m3u8 URL: ${m3u8Url}`);

    ffmpeg(m3u8Url)
        .noVideo()
        .audioCodec('libmp3lame')
        .save(outputPath)
        .on('end', () => {
            console.log(`Audio extracted successfully: ${extractedAudioFileName}`);
            res.json({ audioUrl: `/output/${extractedAudioFileName}` });  // Respond with the URL of the extracted audio
        })
        .on('error', (err) => {
            console.error('Error during m3u8 audio extraction:', err.message);
            res.status(500).send('Audio extraction failed.');
        });
});

// ✅ Handle both mp3 file and mute ranges
app.post('/mute-audio', upload.single('file'), async (req, res) => {
    const { ranges, fromM3u8 } = req.body;
    const parsedRanges = JSON.parse(ranges); // e.g., [{start: "2", end: "5"}, ...]

    let filePath = '';
    let outputFile = '';

    // If fromM3u8 is provided, use the stored filename for the extracted audio
    if (fromM3u8) {
        if (!extractedAudioFileName) {
            return res.status(400).send('No audio extracted to mute. Please extract audio first.');
        }
        filePath = path.join(__dirname, 'output', extractedAudioFileName); // Use stored extracted filename
        outputFile = generateOutputName(); // Use default name for muted audio
    } else if (req.file) {
        filePath = req.file.path; // Use uploaded MP3 file
        outputFile = generateOutputName(); // Use default name for muted audio
    } else {
        return res.status(400).send('No valid audio source provided (file or URL)');
    }

    const outputPath = path.join(__dirname, 'output', outputFile);
    const filterString = createVolumeFilters(parsedRanges);

    console.log('Using audio file for muting:', filePath);

    ffmpeg(filePath)
        .audioFilters(filterString) // Apply mute filter
        .output(outputPath)
        .on('end', () => {
            console.log(`Audio muted successfully: ${outputFile}`);
            res.json({ mutedUrl: `/output/${outputFile}` }); // Return the URL for the muted audio file
        })
        .on('error', (err) => {
            console.error('Error processing audio:', err);
            res.status(500).send('Error muting audio');
        })
        .run();
});

// Start server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
