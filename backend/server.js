const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(bodyParser.json());
app.use('/output', express.static(path.join(__dirname, 'output')));
app.use('/output_hls', express.static(path.join(__dirname, 'output_hls')));

const sourceHLSDir = path.join(__dirname, 'output_hls');
const localM3U8Path = path.join(sourceHLSDir, 'playlist.m3u8');

function createVolumeFilters(ranges) {
  if (ranges.length === 0) return '';
  return ranges.map(({ start, end }) => `volume=enable='between(t,${start},${end})':volume=0`).join(',');
}

function checkM3U8File(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.trim().startsWith('#EXTM3U');
  } catch (error) {
    console.error('Error reading M3U8 file:', error);
    return false;
  }
}


function findTsFile() {
  try {
    const files = fs.readdirSync(sourceHLSDir);
    return files.find(file => file.endsWith('.ts')) ? path.join(sourceHLSDir, files.find(file => file.endsWith('.ts'))) : null;
  } catch (err) {
    console.error('Error finding .ts file:', err);
    return null;
  }
}

app.post('/mute-audio', multer().none(), async (req, res) => {
  const { ranges } = req.body;

  if (!ranges) return res.status(400).send('No valid audio ranges provided');

  let parsedRanges;
  try {
    parsedRanges = JSON.parse(ranges);
    console.log('Parsed Ranges:', parsedRanges);
  } catch (err) {
    console.error('JSON Parse Error:', err);
    return res.status(400).send('Invalid JSON for ranges');
  }

  let inputPath = localM3U8Path;
  let isM3U8Valid = false;

  if (fs.existsSync(localM3U8Path)) {
    isM3U8Valid = checkM3U8File(localM3U8Path);
  }

  if (!isM3U8Valid) {
    const tsFile = findTsFile();
    if (tsFile) {
      console.log('Using .ts file instead of m3u8:', tsFile);
      inputPath = tsFile;
    } else {
      return res.status(404).send('No valid audio source found.');
    }
  }

  const outputName = `muted_${Date.now()}`;
  const outputDir = path.resolve(__dirname, 'output', outputName).replace(/\\/g, '/');
  fs.mkdirSync(outputDir, { recursive: true });

  const playlistFile = 'playlist.m3u8';
  const playlistPath = `${outputDir}/${playlistFile}`;
  const segmentPath = `${outputDir}/segment_%03d.ts`;

  const filterString = createVolumeFilters(parsedRanges);
  console.log('Filter String:', filterString);

  const processAudio = () => {
    return new Promise((resolve, reject) => {
      let command = ffmpeg();

      const normalizedInput = inputPath.replace(/\\/g, '/');
      const finalInput = inputPath.endsWith('.m3u8') ? `file:${normalizedInput}` : normalizedInput;

      command = command.input(finalInput);

      if (inputPath.endsWith('.m3u8')) {
        command = command.inputOptions([
          '-protocol_whitelist', 'file,http,https,tcp,tls',
          '-allowed_extensions', 'ALL'
        ]);
      }

      if (filterString) {
        command = command.audioFilters(filterString);
      }

      command
        .noVideo()
        .audioCodec('aac')
        .format('hls')
        .outputOptions([
          '-hls_time', '5',
          '-hls_list_size', '0',
          `-hls_segment_filename`, segmentPath
        ])
        .output(playlistPath)
        .on('start', commandLine => {
          console.log('FFmpeg Command:', commandLine);
        })
        .on('progress', progress => {
          console.log('Processing:', progress.percent ? progress.percent.toFixed(2) : 'unknown', '% done');
        })
        .on('end', () => {
          console.log(`Muted HLS audio created: ${playlistPath}`);
          resolve(`/output/${outputName}/${playlistFile}`);
        })
        .on('error', err => {
          console.error('Error processing HLS mute:', err.message);
          reject(err);
        });

      command.run();
    });
  };

  try {
    const outputUrl = await processAudio();
    res.json({ mutedUrl: outputUrl });
  } catch (error) {
    console.error('Processing failed:', error);
    res.status(500).send('Error muting audio: ' + error.message);
  }
});

app.get('/test', (req, res) => {
  res.json({ message: 'Server is running correctly' });
});

app.get('/check-source', (req, res) => {
  if (fs.existsSync(localM3U8Path)) {
    const isValid = checkM3U8File(localM3U8Path);
    res.json({ 
      exists: true, 
      isValid,
      path: localM3U8Path,
      directory: fs.readdirSync(sourceHLSDir)
    });
  } else {
    res.json({ 
      exists: false,
      path: localM3U8Path,
      directory: fs.existsSync(sourceHLSDir) ? fs.readdirSync(sourceHLSDir) : 'directory not found'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
