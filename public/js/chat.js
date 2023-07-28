var socket = io();

// 안읽은 메시지 개수 0으로
$('#notread').text(0);
$.get('/unread_clear');

// 초기 화면 맨 아래로
let chatroom = $('.chatroom');
chatroom.scrollTop(chatroom[0].scrollHeight);

// 렌더링 된 가장 최근 메시지의 날짜
let lastMessageDate = $('.chatroom .chat').last().data('time');
if(lastMessageDate !== undefined) {
    lastMessageDate = new Date(parseInt(lastMessageDate)).toLocaleDateString();
}

socket.on('message', (data) => {
    if(!data) {
        alert("Server Error");
        return;
    }

    // 날짜 구분선 추가
    const date = new Date(data.time);
    const messageDate = date.toLocaleDateString();
    if(messageDate !== lastMessageDate) {
        $('.chatroom').append(`
        <div class="chatdate">
            --------------------------------- ${messageDate} ---------------------------------
        </div>
        `);
        lastMessageDate = messageDate;
    }

    if($('#message').data('author') === data.author) {
        // 내가 보낸 메시지
        $('.chatroom').append(`
            <div class="chat mychat" data-time="${data.time}">
                <p class="chat-name">${data.author}</p>
                <div class="chat-content">
                    <span class="time">${String(date.getHours()).padStart(2,'0')+":"+String(date.getMinutes()).padStart(2,'0')}</span>
                    <span class="tag is-link">${data.message}</span>
                </div>
            </div>
        `);
    } else {
        // 상대가 보낸 메시지
        $('.chatroom').append(`
            <div class="chat" data-time="${data.time}">
                <p class="chat-name">${data.author}</p>
                <div class="chat-content">
                    <span class="tag is-link is-light">${data.message}</span>
                    <span class="time">${String(date.getHours()).padStart(2,'0')+":"+String(date.getMinutes()).padStart(2,'0')}</span>
                </div>
            </div>
        `);
    }
    chatroom.scrollTop(chatroom[0].scrollHeight);
})

// chat message 전송
$('#send').on('click', function() {
    var chatdata = {
        author: $('#message').data('author'),
        time: new Date().getTime(),
        message: $('#message').val()
    }
    socket.emit('group-chat', chatdata);

    // 나머지 모든 사람의 안읽은 메시지 개수 1 증가
    $.get('/unread');
    // 메시지박스 비우기
    $('#message').val('');
})