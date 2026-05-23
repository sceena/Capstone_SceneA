require('dotenv').config();
const os = require('os');

const config = {
  server: {
    port: process.env.PORT || 4000,
    springBootUrl: process.env.SPRING_BOOT_URL || 'http://localhost:8080',
    corsOrigins: [
      'http://localhost:3000',
      'http://localhost:5173',
      // 같은 네트워크 기기에서 접근 시 아래에 PC 로컬 IP 추가
      // 예: 'http://192.168.0.5:5173'
      ...(process.env.LOCAL_IP ? [`http://${process.env.LOCAL_IP}:5173`] : []),
    ],
  },
  mediasoup: {
    numWorkers: os.cpus().length,
    workerSettings: {
      rtcMinPort: parseInt(process.env.RTC_MIN_PORT) || 10000,
      rtcMaxPort: parseInt(process.env.RTC_MAX_PORT) || 10100,
      logLevel: 'warn',
    },
    routerOptions: {
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: { 'x-google-start-bitrate': 1000 },
        },
        {
          kind: 'video',
          mimeType: 'video/H264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '42e01f',
            'level-asymmetry-allowed': 1,
          },
        },
      ],
    },
    webRtcTransportOptions: {
      listenIps: [
        {
          ip: '0.0.0.0',
          announcedIp: process.env.ANNOUNCED_IP || '127.0.0.1',
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      maxIncomingBitrate: 1500000,
      initialAvailableOutgoingBitrate: 1000000,
    },
  },
};

module.exports = config;
