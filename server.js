const express = require('express');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const multer = require('multer');
const app = express();
const dotenv = require('dotenv');

const MAX_FILE_SIZE_MB = 30
const PORT = process.env.EXPRESS_PORT || 8080

// Load environment variables from .env file
dotenv.config();

// Configure AWS SDK v3 with your credentials and S3 region
const s3Client = new S3Client({
    region: process.env.S3_REGION,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
});

// Set up Multer storage for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE_MB * 1024 * 1024
    },
}).single('file');

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Handle file upload POST request
app.post('/upload', (req, res) => {

    upload(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // Multer error occurred
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).send(`File size exceeds the limit of ${MAX_FILE_SIZE_MB}MB`);
            }
            return res.status(500).send('Error uploading file');
        } else if (err) {
            // Other error occurred
            console.error('Error uploading file:', err);
            return res.status(500).send('Error uploading file');
        }

        const file = req.file;

        // Set up the parameters for the S3 upload
        const params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: file.originalname,
            Body: file.buffer,
            ACL: 'public-read', // Set ACL to public-read
        };

        // Upload the file to S3 bucket using the PutObject command
        s3Client.send(new PutObjectCommand(params))
            .then(data => {
                const fileUrl = `https://${params.Bucket}.s3.amazonaws.com/${params.Key}`;
                res.json({ url: fileUrl });
            })
            .catch(err => {
                console.error('Error uploading file to S3:', err);
                res.status(500).send('Error uploading file to S3');
            });
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
