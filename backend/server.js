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


const upload = multer({ dest: 'uploads/' });


const generateOutputName = (prefix = 'muted') => `${prefix}_${Date.now()}.mp3`;


let extractedAudioFileName = '';

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

cleanOutputFolder();


app.post('/extract-audio', async (req, res) => {
    const { m3u8Url } = req.body;
    extractedAudioFileName = generateOutputName('extracted'); 
    const outputPath = path.join(__dirname, 'output', extractedAudioFileName);

    console.log(`Starting extraction from m3u8 URL: ${m3u8Url}`);

    ffmpeg(m3u8Url)
        .noVideo()
        .audioCodec('libmp3lame')
        .save(outputPath)
        .on('end', () => {
            console.log(`Audio extracted successfully: ${extractedAudioFileName}`);
            res.json({ audioUrl: `/output/${extractedAudioFileName}` });  
        })
        .on('error', (err) => {
            console.error('Error during m3u8 audio extraction:', err.message);
            res.status(500).send('Audio extraction failed.');
        });
});


app.post('/mute-audio', upload.single('file'), async (req, res) => {
    const { ranges, fromM3u8 } = req.body;
    const parsedRanges = JSON.parse(ranges); 

    let filePath = '';
    let outputFile = '';

    if (fromM3u8) {
        if (!extractedAudioFileName) {
            return res.status(400).send('No audio extracted to mute. Please extract audio first.');
        }
        filePath = path.join(__dirname, 'output', extractedAudioFileName); 
        outputFile = generateOutputName(); 
    } else if (req.file) {
        filePath = req.file.path; 
        outputFile = generateOutputName(); 
    } else {
        return res.status(400).send('No valid audio source provided (file or URL)');
    }

    const outputPath = path.join(__dirname, 'output', outputFile);
    const filterString = createVolumeFilters(parsedRanges);

    console.log('Using audio file for muting:', filePath);

    ffmpeg(filePath)
        .audioFilters(filterString) 
        .output(outputPath)
        .on('end', () => {
            console.log(`Audio muted successfully: ${outputFile}`);
            res.json({ mutedUrl: `/output/${outputFile}` }); 
        })
        .on('error', (err) => {
            console.error('Error processing audio:', err);
            res.status(500).send('Error muting audio');
        })
        .run();
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
