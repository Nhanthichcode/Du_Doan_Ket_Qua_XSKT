const express = require('express');
const { spawn } = require('child_process');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Hàm gọi các file Python đồng bộ theo tên file thực tế của bạn
const runPythonScript = (scriptName, args = []) => {
    return new Promise((resolve, reject) => {
        console.log(`Node.js đang gọi tiến trình Python: ${scriptName} ${args.join(' ')}`);
        const pythonProcess = spawn('python', [scriptName, ...args]);
        let output = '';
        let error = '';

        pythonProcess.stdout.on('data', (data) => { output += data.toString(); });
        pythonProcess.stderr.on('data', (data) => { error += data.toString(); });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                resolve(output.trim());
            } else {
                console.error(`❌ Thất bại tại file ${scriptName}:`, error);
                reject(`Lỗi tại file ${scriptName}: ${error}`);
            }
        });
    });
};

// VÒNG LẶP PIPELINE TỰ ĐỘNG CẬP NHẬT & TÁI HUẤN LUYỆN AI MỖI NGÀY
const runDailyMLOpsPipeline = async () => {
    console.log("⏰ [7:00 AM] Kích hoạt hệ thống cập nhật tự động...");
    try {
        // Bước 1: Thu thập kết quả mở thưởng mới nhất
        console.log("-> Bước 1: Thu thập kết quả quay số mới...");
        await runPythonScript('cao_du_lieu_tu_dong.py');

        // Bước 2: Chế biến cấu trúc dữ liệu máy học (8 cột đặc trưng)
        console.log("-> Bước 2: Tạo dữ liệu huấn luyện (data_training_ai.csv)...");
        await runPythonScript('chuyen_thanh_du_lieu_huan_luyen.py');

        // Bước 3: Huấn luyện lại mô hình (Cập nhật file .pkl)
        console.log("-> Bước 3: Tái huấn luyện mô hình học máy (master_ai.py)...");
        const trainLog = await runPythonScript('master_ai.py');
        console.log("📊 Nhật ký AI:", trainLog);

        // Bước 4: Chạy thuật toán dự đoán động cho các đài hôm nay (Tự động nhận diện 3 hoặc 4 đài)
        console.log("-> Bước 4: Thực thi thuật toán dự đoán các đài mở thưởng hôm nay...");
        const rawJson = await runPythonScript('du_doan.py'); 
        const data = JSON.parse(rawJson);

        // Bước 5: Gửi báo cáo phân tích vào Gmail của bạn
        console.log("-> Bước 5: Đang tiến hành soạn gửi báo cáo Email...");
        await sendMailReport(data);
        console.log("✨ [HOÀN THÀNH] Toàn bộ chuỗi tác vụ MLOps đã chạy thành công mỹ mãn!");
    } catch (err) {
        console.error("💥 Hệ thống tự động gặp sự cố nghiêm trọng:", err);
    }
};

// HÀM SOẠN BÁO CÁO GỬI EMAIL TỰ ĐỘNG CHỨA BIẾN ĐỘNG ĐÀI TRONG NGÀY
const sendMailReport = async (data) => {
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { 
            user: process.env.EMAIL_USER, 
            pass: process.env.EMAIL_PASS 
        }
    });

    let htmlBody = `<h2 style="color: #2c3e50;">HỆ THỐNG MLOPS XSMN BÁO CÁO TỰ ĐỘNG</h2>`;
    
    if (data.success) {
        htmlBody += `<p><b>Dự đoán lịch quay:</b> Thứ ${data.thu} (Ngày ${data.ngay_du_doan})</p>`;
        htmlBody += `<p style="color: #27ae60; font-weight: bold;">Hôm nay hệ thống phát hiện có ${data.results.length} đài mở thưởng.</p>`;
        htmlBody += `<hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;"/>`;

        // Vòng lặp tự động duyệt qua tất cả các đài thực tế có trong ngày (3 hoặc 4 đài)
        data.results.forEach(daiResult => {
            htmlBody += `<div style="margin-bottom: 25px; background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #3498db;">`;
            htmlBody += `<h3 style="color: #2980b9; margin-top:0; letter-spacing: 1px;">🔮 ĐÀI: ${daiResult.dai.toUpperCase()}</h3>`;
            htmlBody += `<p style="font-size: 12px; color: #7f8c8d; margin-bottom: 10px;">Dữ liệu lịch sử gốc đồng bộ đến ngày: ${daiResult.ngay_cap_nhat_cu}</p>`;
            htmlBody += `<ul style="list-style-type: none; padding-left: 0;">`;
            
            daiResult.predictions.forEach(p => {
                htmlBody += `<li style="padding: 6px 0; border-bottom: 1px dashed #eee;">`;
                htmlBody += `Cặp số vàng: <b style="font-size:18px; color: #2c3e50;">${p.so}</b> — Xác suất nổ: <span style="color:#e74c3c; font-weight:bold; font-size:16px;">${p.xac_suat}%</span>`;
                htmlBody += `</li>`;
            });
            
            htmlBody += `</ul></div>`;
        });
    } else {
        htmlBody += `<p style="color: red; font-weight: bold;">Quá trình xử lý dự đoán tự động xảy ra lỗi mô hình: ${data.error}</p>`;
    }

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_RECEIVER,
        subject: `[AI BOT] Dự Đoán XSMN Ngày Mới - Thứ ${data.thu} (${data.ngay_du_doan})`,
        html: htmlBody
    });
    console.log("✈️ Thư báo cáo đã được gửi tới hòm thư Gmail của bạn thành công.");
};

// CẤU HÌNH LỊCH CHẠY: Đúng 7h00 sáng mỗi ngày theo múi giờ Việt Nam
cron.schedule('0 7 * * *', () => {
    runDailyMLOpsPipeline();
}, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh"
});

// CỔNG API PHỤC VỤ CHO BIỂU ĐỒ FRONTEND (Trả toàn bộ các đài trong ngày)
app.get('/api/predictions', async (req, res) => {
    try {
        const rawData = await runPythonScript('du_doan.py'); 
        res.json(JSON.parse(rawData));
    } catch (error) {
        res.status(500).json({ success: false, error: error.toString() });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Node MLOps Backend đang kích hoạt tại Port ${PORT}`));