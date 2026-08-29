// // emailService.js
// const nodemailer = require('nodemailer');

// const transporter = nodemailer.createTransport({
//     service: 'Gmail', // or another email service like Outlook, Yahoo
//     auth: {
//         user: process.env.EMAIL_USER, // Your email address
//         pass: process.env.EMAIL_PASS, // Your email password or app-specific password
//     },
// });

// async function sendEmail(to, subject, text) {
//     const mailOptions = {
//         from: process.env.EMAIL_USER, // Sender address
//         to, // List of recipients
//         subject, // Subject line
//         text, // Plain text body
//     };

//     try {
//         const info = await transporter.sendMail(mailOptions);
//         console.log('Email sent: ' + info.response);
//         return true;
//     } catch (error) {
//         console.error('Error sending email: ', error);
//         throw error;
//     }
// }

// module.exports = { sendEmail };
