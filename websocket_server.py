import socket
import select
import hashlib
import base64

def encode_frame(message):
    data = message.encode('utf-8')
    header = bytearray([0x81])
    if len(data) <= 125:
        header.append(len(data))
    elif len(data) <= 65535:
        header.append(126)
        header.extend(len(data).to_bytes(2, byteorder='big'))
    else:
        header.append(127)
        header.extend(len(data).to_bytes(8, byteorder='big'))
    return bytes(header + data)

def decode_frame(data):
    if len(data) < 6:
        return None
    # check FIN and opcode (text is 1, close is 8)
    opcode = data[0] & 0x0F
    if opcode == 8: # Close frame
        return "close"
    if opcode != 1:
        return None
        
    payload_len = data[1] & 127
    mask_start = 2
    if payload_len == 126:
        payload_len = int.from_bytes(data[2:4], byteorder='big')
        mask_start = 4
    elif payload_len == 127:
        payload_len = int.from_bytes(data[2:10], byteorder='big')
        mask_start = 10
    
    if len(data) < mask_start + 4 + payload_len:
        return None
        
    mask_key = data[mask_start:mask_start+4]
    payload = data[mask_start+4:mask_start+4+payload_len]
    decoded = bytearray(payload_len)
    for i in range(payload_len):
        decoded[i] = payload[i] ^ mask_key[i % 4]
    return decoded.decode('utf-8')

def handle_handshake(sock):
    try:
        request = sock.recv(1024).decode('utf-8')
        headers = {}
        for line in request.split('\r\n')[1:]:
            if ': ' in line:
                k, v = line.split(': ', 1)
                headers[k] = v
        key = headers.get('Sec-WebSocket-Key')
        if not key:
            return False
        accept = base64.b64encode(hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode('utf-8')).digest()).decode('utf-8')
        response = (
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            "Sec-WebSocket-Accept: {}\r\n\r\n"
        ).format(accept)
        sock.send(response.encode('utf-8'))
        return True
    except Exception as e:
        print("Handshake exception:", e)
        return False

def main():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        server.bind(('0.0.0.0', 8001))
    except Exception as e:
        print(f"Error binding to port 8001: {e}")
        return
        
    server.listen(10)
    print("WebSocket server running on ws://localhost:8001...")

    sockets = [server]
    clients = {} # socket -> handshake_done (bool)

    while True:
        try:
            r, _, _ = select.select(sockets, [], [], 1.0)
            for s in r:
                if s is server:
                    conn, addr = server.accept()
                    sockets.append(conn)
                    clients[conn] = False
                else:
                    if not clients[s]:
                        if handle_handshake(s):
                            clients[s] = True
                            print("Handshake successful with client:", s.getpeername())
                        else:
                            s.close()
                            if s in sockets: sockets.remove(s)
                            if s in clients: del clients[s]
                    else:
                        try:
                            data = s.recv(4096)
                            if not data:
                                print("Client disconnected.")
                                s.close()
                                if s in sockets: sockets.remove(s)
                                if s in clients: del clients[s]
                                continue
                            msg = decode_frame(data)
                            if msg == "close":
                                print("Client sent close frame.")
                                s.close()
                                if s in sockets: sockets.remove(s)
                                if s in clients: del clients[s]
                                continue
                            if msg:
                                print("Broadcasting message:", msg)
                                # Broadcast to all OTHER clients
                                frame = encode_frame(msg)
                                for c in list(clients.keys()):
                                    if c != s and clients[c]:
                                        try:
                                            c.send(frame)
                                        except Exception as e:
                                            print("Send error:", e)
                                            c.close()
                                            if c in sockets: sockets.remove(c)
                                            if c in clients: del clients[c]
                        except Exception as e:
                            print("Socket read/write error:", e)
                            s.close()
                            if s in sockets: sockets.remove(s)
                            if s in clients: del clients[s]
        except KeyboardInterrupt:
            print("Stopping WebSocket server...")
            break
        except Exception as e:
            print("Server loop exception:", e)

    # Clean up
    for s in sockets:
        s.close()

if __name__ == '__main__':
    main()
