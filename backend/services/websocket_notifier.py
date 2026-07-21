import socket
import json

def notify_websocket(msg_dict):
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.sendto(json.dumps(msg_dict).encode('utf-8'), ("127.0.0.1", 5002))
    except Exception as e:
        print("Failed to send WebSocket notification:", e)
