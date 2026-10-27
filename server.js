
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();

app.get("/", (req, res) => {
  res.json({
    name: "Chicken Gun Multiplayer",
    status: "online"
  });
});

app.get("/api/servers", (req, res) => {
  const servers = [];

  for (const [id, room] of rooms) {
    servers.push({
      id,
      name: room.name,
      players: room.players.size,
      maxPlayers: 8
    });
  }

  res.json({ ok: true, servers });
});

io.on("connection", (socket) => {
  socket.on("createGame", ({ name } = {}, callback) => {
    const roomId = Math.random().toString(36).slice(2, 8);
    const room = {
      name: String(name || "Chicken Server").slice(0, 32),
      players: new Map()
    };

    rooms.set(roomId, room);
    joinRoom(socket, roomId, callback);
  });

  socket.on("joinGame", ({ roomId } = {}, callback) => {
    joinRoom(socket, String(roomId || ""), callback);
  });

  socket.on("playerMove", (data = {}) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);

    if (!room || !room.players.has(socket.id)) return;

    const position = {
      x: Number(data.x),
      y: Number(data.y),
      z: Number(data.z)
    };

    if (!Object.values(position).every(Number.isFinite)) return;

    room.players.set(socket.id, position);

    socket.to(roomId).emit("playerMoved", {
      id: socket.id,
      position
    });
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);

    if (!room) return;

    room.players.delete(socket.id);
    socket.to(roomId).emit("playerLeft", socket.id);

    if (room.players.size === 0) {
      rooms.delete(roomId);
    }
  });
});

function joinRoom(socket, roomId, callback) {
  const room = rooms.get(roomId);

  if (!room) {
    return reply(callback, {
      ok: false,
      error: "Server not found"
    });
  }

  if (room.players.size >= 8) {
    return reply(callback, {
      ok: false,
      error: "Server is full"
    });
  }

  if (socket.data.roomId) {
    const oldRoom = rooms.get(socket.data.roomId);

    if (oldRoom) {
      oldRoom.players.delete(socket.id);
      socket.to(socket.data.roomId).emit("playerLeft", socket.id);

      if (oldRoom.players.size === 0) {
        rooms.delete(socket.data.roomId);
      }
    }

    socket.leave(socket.data.roomId);
  }

  socket.join(roomId);
  socket.data.roomId = roomId;
  room.players.set(socket.id, { x: 0, y: 0, z: 0 });

  reply(callback, {
    ok: true,
    roomId,
    playerId: socket.id,
    players: [...room.players.entries()].map(([id, position]) => ({
      id,
      position
    }))
  });

  socket.to(roomId).emit("playerJoined", {
    id: socket.id,
    position: { x: 0, y: 0, z: 0 }
  });
}

function reply(callback, result) {
  if (typeof callback === "function") callback(result);
}

const PORT = process.env.PORT || 10000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Multiplayer server listening on port ${PORT}`);
});
