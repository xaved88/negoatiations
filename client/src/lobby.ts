import { Client, Room } from 'colyseus.js';

export async function showLobby(
  onJoinRoom: (room: Room) => void
): Promise<void> {
  const lobbyDiv = document.getElementById('lobby') as HTMLElement;
  const containerDiv = document.getElementById('game-container') as HTMLElement;

  lobbyDiv.style.display = 'flex';
  containerDiv.style.display = 'none';

  const colyseus = new Client('ws://localhost:2567');

  const playerNameInput = document.getElementById(
    'player-name'
  ) as HTMLInputElement;
  const createGameBtn = document.getElementById(
    'create-game-btn'
  ) as HTMLButtonElement;
  const roomsList = document.getElementById('rooms-list') as HTMLElement;

  // Create game button handler
  createGameBtn.addEventListener('click', async () => {
    const name = playerNameInput.value.trim();
    if (!name) {
      alert('Please enter a name');
      return;
    }

    try {
      const room = await colyseus.create('game', { name });
      playerNameInput.value = '';
      lobbyDiv.style.display = 'none';
      containerDiv.style.display = 'block';
      onJoinRoom(room);
    } catch (error) {
      console.error('Failed to create game:', error);
      alert('Failed to create game');
    }
  });

  // List available rooms
  async function updateRoomsList() {
    try {
      const rooms = await colyseus.getAvailableRooms('game');
      roomsList.innerHTML = '';

      if (rooms.length === 0) {
        roomsList.innerHTML = '<div class="no-rooms">No games available. Create one!</div>';
        return;
      }

      for (const roomInfo of rooms) {
        const div = document.createElement('div');
        div.className = 'room-item';

        const hostName = roomInfo.metadata?.hostName || 'Unknown';
        const playerCount = `${roomInfo.clients || 0}/${roomInfo.maxClients || 5}`;

        div.innerHTML = `
          <div class="room-info">
            <div class="room-name">${hostName}'s game</div>
            <div class="room-players">Room: ${roomInfo.roomId}</div>
          </div>
          <div class="player-count">${playerCount}</div>
        `;

        div.addEventListener('click', async () => {
          const name = playerNameInput.value.trim();
          if (!name) {
            alert('Please enter a name');
            return;
          }

          try {
            const room = await colyseus.joinById(roomInfo.roomId, { name });
            playerNameInput.value = '';
            lobbyDiv.style.display = 'none';
            containerDiv.style.display = 'block';
            onJoinRoom(room);
          } catch (error) {
            console.error('Failed to join game:', error);
            alert('Failed to join game');
          }
        });

        roomsList.appendChild(div);
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
      roomsList.innerHTML = '<div class="loading">Error loading rooms...</div>';
    }
  }

  // Poll rooms every 2 seconds
  updateRoomsList();
  setInterval(updateRoomsList, 2000);

  // Allow enter key to create/focus
  playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      createGameBtn.click();
    }
  });
}
