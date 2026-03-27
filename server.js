const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 存储连接的客户端，最多2个
let clients = [];
let userCount = 0;

wss.on('connection', (ws) => {
  // 超过2人拒绝连接
  if (clients.length >= 2) {
    ws.send(JSON.stringify({
      type: 'error',
      message: '聊天室已满，最多支持2人同时聊天'
    }));
    ws.close();
    return;
  }

  // 分配用户ID
  userCount++;
  const userId = userCount;
  clients.push({ ws, userId });

  console.log(`用户 ${userId} 已连接，当前在线: ${clients.length}/2`);

  // 通知所有人用户加入
  broadcast({
    type: 'system',
    message: `用户${userId}已加入聊天`,
    onlineCount: clients.length
  });

  // 发送欢迎消息给新用户
  ws.send(JSON.stringify({
    type: 'welcome',
    userId: userId,
    message: '欢迎进入聊天！',
    onlineCount: clients.length
  }));

  // 处理消息
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // 转发消息给另一个用户
      clients.forEach(client => {
        if (client.ws !== ws && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify({
            type: 'message',
            userId: userId,
            content: data.content,
            timestamp: new Date().toISOString()
          }));
        }
      });

      // 发送给自己确认
      ws.send(JSON.stringify({
        type: 'message_self',
        userId: userId,
        content: data.content,
        timestamp: new Date().toISOString()
      }));

    } catch (error) {
      console.error('消息解析错误:', error);
    }
  });

  // 处理断开连接
  ws.on('close', () => {
    clients = clients.filter(client => client.ws !== ws);
    console.log(`用户 ${userId} 已断开连接，当前在线: ${clients.length}/2`);

    broadcast({
      type: 'system',
      message: `用户${userId}已离开聊天`,
      onlineCount: clients.length
    });
  });

  // 错误处理
  ws.on('error', (error) => {
    console.error('WebSocket错误:', error);
  });
});

// 广播消息给所有客户端
function broadcast(data) {
  clients.forEach(client => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
    }
  });
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`WebSocket 服务已启动，支持最多2人同时聊天`);
});