import socket
import threading
import re
from .websocket_notifier import notify_websocket

class ScaleConnectionManager:
    def __init__(self):
        self.connections = {}
        self.lock = threading.Lock()

    def connect_scale(self, scale_id, ip, port, is_simulator=False, data_format="densi"):
        with self.lock:
            self.disconnect_scale_unlocked(scale_id)

            if is_simulator:
                self.connections[scale_id] = {
                    "socket": None,
                    "thread": None,
                    "last_weight": 0.0,
                    "active": True,
                    "is_simulator": True,
                    "data_format": data_format
                }
                return True

            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(2.0)
                sock.connect((ip, int(port)))
                sock.settimeout(None)
                
                state = {
                    "socket": sock,
                    "active": True,
                    "last_weight": 0.0,
                    "is_simulator": False,
                    "data_format": data_format
                }
                
                thread = threading.Thread(
                    target=self._read_loop, 
                    args=(scale_id, state), 
                    daemon=True
                )
                state["thread"] = thread
                self.connections[scale_id] = state
                thread.start()
                return True
            except Exception as e:
                print(f"Failed to connect to scale {scale_id} ({ip}:{port}): {e}")
                return False

    def disconnect_scale(self, scale_id):
        with self.lock:
            self.disconnect_scale_unlocked(scale_id)

    def disconnect_scale_unlocked(self, scale_id):
        if scale_id in self.connections:
            state = self.connections[scale_id]
            state["active"] = False
            if state["socket"]:
                try:
                    state["socket"].close()
                except Exception:
                    pass
            del self.connections[scale_id]

    def _read_loop(self, scale_id, state):
        sock = state["socket"]
        buffer = ""
        while state["active"]:
            try:
                data = sock.recv(1024)
                if not data:
                    break
                buffer += data.decode('ascii', errors='ignore')
                
                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    line = line.strip()
                    
                    weight_str = None
                    if state.get("data_format") == "densi":
                        # Densi Format: ST,GS,+ 12.34 kg
                        # Regex to capture the sign (group 3) and data (group 4)
                        match = re.search(r'(?:ST|US|OL)\s*,\s*(?:GS|NT)\s*,\s*([+\-])?\s*(\d+\.?\d*)\s*(?:kg|lb|g|gr)', line, re.IGNORECASE)
                        if match:
                            sign = match.group(1) or ""
                            val_str = match.group(2)
                            weight_str = sign + val_str
                    else:
                        # Fallback / Raw numeric parsing
                        match = re.search(r'([+\-]?\s*\d+\.?\d*)\s*(?:k?g|gr?)', line, re.IGNORECASE)
                        if match:
                            weight_str = match.group(1).replace(" ", "")

                    if weight_str is not None:
                        try:
                            val = float(weight_str)
                            state["last_weight"] = val
                            notify_websocket({
                                "type": "weight_update",
                                "scale_id": scale_id,
                                "weight": val
                            })
                        except ValueError:
                            pass
            except Exception:
                break
        state["active"] = False
        if sock:
            try:
                sock.close()
            except Exception:
                pass

    def get_weight(self, scale_id):
        with self.lock:
            if scale_id in self.connections:
                return self.connections[scale_id]["last_weight"], self.connections[scale_id]["active"]
            return 0.0, False

    def set_simulated_weight(self, scale_id, weight):
        with self.lock:
            if scale_id in self.connections and self.connections[scale_id].get("is_simulator"):
                val = float(weight)
                self.connections[scale_id]["last_weight"] = val
                notify_websocket({
                    "type": "weight_update",
                    "scale_id": scale_id,
                    "weight": val
                })
                return True
            return False

scale_manager = ScaleConnectionManager()
