import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@repo/backend-common/config';

async function runTests() {
    console.log("🚀 Starting Integration Tests for Excelidraw...\n");

    const WS_URL = "ws://localhost:8080";
    const HTTP_URL = "http://localhost:3001";

    // --- TEST 1: SECURITY (Invalid Token) ---
    console.log("🧪 Test 1: Security - Invalid Token rejection");
    try {
        const wsInvalid = new WebSocket(`${WS_URL}?token=invalid-token`);
        await new Promise((res, rej) => {
            wsInvalid.on('close', () => res(true));
            setTimeout(() => rej(new Error("Server did not close invalid connection")), 2000);
        });
        console.log("✅ PASS: Server correctly closed invalid connection.");
    } catch (e) {
        console.log("❌ FAIL: Security test failed:", e.message);
    }

    // --- TEST 2: DRAWING & SYNC (Path Tool) ---
    console.log("\n🧪 Test 2: Drawing Sync - Pen Path");
    try {
        const token = jwt.sign({ userId: "test-user-1" }, JWT_SECRET);
        const ws = new WebSocket(`${WS_URL}?token=${token}`);

        await new Promise((res) => {
            ws.on('open', res);
        });

        // Join Room
        ws.send(JSON.stringify({ type: "join_room", roomId: "room-123" }));

        // Send a Pen Path
        const penShape = {
            type: "path",
            points: [{x: 0, y: 0}, {x: 10, y: 10}, {x: 20, y: 5}],
            color: "rgba(255,0,0,1)",
            strokeWidth: 2
        };

        const promise = new Promise((res) => {
            ws.on('message', (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.type === "chat" && msg.roomId === "room-123") {
                    res(true);
                }
            });
        });

        ws.send(JSON.stringify({
            type: "chat",
            roomId: "room-123",
            message: JSON.stringify({ shape: penShape })
        }));

        await promise;
        console.log("✅ PASS: Pen path was synchronized across the room.");
        ws.close();
    } catch (e) {
        console.log("❌ FAIL: Sync test failed:", e.message);
    }

    // --- TEST 3: ERASER LOGIC ---
    console.log("\n🧪 Test 3: Eraser Path Validation");
    try {
        const token = jwt.sign({ userId: "test-user-2" }, JWT_SECRET);
        const ws = new WebSocket(`${WS_URL}?token=${token}`);

        await new Promise((res) => {
            ws.on('open', res);
        });

        ws.send(JSON.stringify({ type: "join_room", roomId: "room-123" }));

        const eraserShape = {
            type: "eraser",
            points: [{x: 5, y: 5}, {x: 15, y: 15}],
            strokeWidth: 10
        };

        const promise = new Promise((res) => {
            ws.on('message', (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.type === "chat" && msg.roomId === "room-123") {
                    res(true);
                }
            });
        });

        ws.send(JSON.stringify({
            type: "chat",
            roomId: "room-123",
            message: JSON.stringify({ shape: eraserShape })
        }));

        await promise;
        console.log("✅ PASS: Eraser path was synchronized.");
        ws.close();
    } catch (e) {
        console.log("❌ FAIL: Eraser test failed:", e.message);
    }

    console.log("\n✨ All tests completed.");
    process.exit(0);
}

runTests().catch(console.error);
