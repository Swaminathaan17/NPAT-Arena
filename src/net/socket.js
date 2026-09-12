import { io } from 'socket.io-client';

const PROD_FALLBACK = 'https://npat-arena-server.onrender.com';

export const API_URL =
  import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : PROD_FALLBACK);

export const connect = () =>
  io(API_URL, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
  });

export const API_URL_LABEL = API_URL;