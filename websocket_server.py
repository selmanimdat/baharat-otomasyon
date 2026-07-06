import asyncio
import websockets
import socket
import threading
import json
import traceback

CONNECTED_CLIENTS = set()

async def handler(websocket, path=None):
    CONNECTED_CLIENTS.add(websocket)
    try:
        async for message in websocket:
            # We don't expect messages from clients, but if they send any, log them
            pass
    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as e:
        print(f"Connection error: {e}")
    finally:
        CONNECTED_CLIENTS.remove(websocket)

async def broadcast(message):
    if not CONNECTED_CLIENTS:
        return
    
    # Broadcast to all connected clients
    disconnected = set()
    for client in CONNECTED_CLIENTS:
        try:
            await client.send(message)
        except Exception:
            disconnected.add(client)
            
    for client in disconnected:
        try:
            CONNECTED_CLIENTS.remove(client)
        except KeyError:
            pass

def start_udp_listener(loop):
    # A simple local UDP listener on 127.0.0.1:5002 to receive events from Flask
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(("127.0.0.1", 5002))
    print("UDP Event Listener listening on 127.0.0.1:5002")
    
    while True:
        try:
            data, addr = sock.recvfrom(65535)
            msg = data.decode('utf-8')
            asyncio.run_coroutine_threadsafe(broadcast(msg), loop)
        except Exception as e:
            print(f"Error in UDP listener: {e}")
            traceback.print_exc()

async def main():
    loop = asyncio.get_running_loop()
    
    # Run the UDP listener in a separate daemon thread
    udp_thread = threading.Thread(target=start_udp_listener, args=(loop,), daemon=True)
    udp_thread.start()
    
    # Start the WebSocket server on port 5001
    async with websockets.serve(handler, "0.0.0.0", 5001):
        print("WebSocket Server listening on ws://0.0.0.0:5001")
        # Run forever
        await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("WebSocket Server stopped.")
