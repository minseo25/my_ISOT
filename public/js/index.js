// 안 읽은 메시지 개수 업데이트
var socket = io({
    path: '/my_ISOT/socket.io/'
});

socket.on('message', (data) => {
    if(!data) {
        return;
    }
    var unreadNum = parseInt($('#notread').text())+1;
    $('#notread').text(unreadNum);
});

// UI 관련 함수들
function make_readonly() {
    $('#each-note-title').attr('readonly', 'readonly');
    $('#each-note-mention').attr('readonly', 'readonly');
    $('#each-note-message').attr('readonly', 'readonly');
    $('#each-note-delete').hide();
    $('#each-note-create').hide();
    $('#each-note-modify').show();
    $('#each-note-comment').show();
    $('#each-note-detail').show();
    $('#each-note-save').hide();
}
function make_editable() {
    $('#each-note-title').removeAttr('readonly');
    $('#each-note-mention').removeAttr('readonly');
    $('#each-note-message').removeAttr('readonly');
    $('#each-note-delete').show();
    $('#each-note-save').show();
    $('#each-note-modify').hide();
    $('#each-note-comment').hide();
    $('#each-note-detail').hide();
}
function initialize() {
    make_editable();
    $('#each-note-delete').hide();
    $('#each-note-save').hide();
    $('#each-note-create').show();
    $('#each-note-title').val('');
    $('#each-note-mention').val('');
    $('#each-note-message').val('');
}

$('#each-note-create').hide();
$('#each-note-save').hide();

// $.ajax success/error 콜백을 써야지 status 코드에 따른 구분 가능
// $.get() , $.post() 함수는 status code 400, 500 도 에러 없이 처리해서 try-catch 구문에 잡히지 않는다
// 각 노트 보기
function addListenerToComment() {
    $('.comment-delete').off('click').on('click', function() {
        const deleted_comment = $(this).closest('article');
        $.get({
            url: './delete_comment?num='+$(this).data('num'),
            type: 'GET',
            success: function(data) {
                deleted_comment.remove();
            },
            error: function(req, status, error) {
                alert(req.responseText);
            }
        })
    });
}
function addListenerToNote() {
    $('.each-note').off('click').on('click', function() {
        make_readonly();
        const clickedNote = $(this);
        $.ajax({
            url: './get_note?num='+clickedNote.data('num'),
            type: 'GET',
            success: function(data) {
                // 게시물 내용 채우기 + 읽음처리
                const note = data.note;
                $('#each-note-title').val(note.title);
                $('#each-note-mention').val(note.mentioned.join(', '));
                $('#each-note-message').val(note.message);
                $('#each-note-detail').html(`작성자: ${note.author} &nbsp;&nbsp; 최종수정시각: ${new Date(note.time).toLocaleString()}`);
                $('#each-note-detail').data('num', note.numNote.toString());
                if(!clickedNote.hasClass('note-read')) {
                    clickedNote.addClass('note-read');
                    $('#not-read-counter').text(parseInt($('#not-read-counter').text())-1);
                }

                // 댓글 내용 채우기
                $('.comment-container').html('');
                for(var comment of data.comments) {
                    $('.comment-container').append(`
                        <article class="media comment">
                            <figure class="media-left">
                                <p class="image is-64x64">
                                    <img src="/my_ISOT/public/pictures/${comment.uid}.jpg" 
                                        onerror="this.onerror=null; 
                                            this.src='/my_ISOT/public/pictures/${comment.uid}.png';
                                            this.onerror=(function() {
                                                this.onerror=null; 
                                                this.src='/my_ISOT/public/pictures/${comment.uid}.jpeg';
                                            })"
                                    >
                                </p>
                            </figure>
                            <div class="media-content">
                                <div class="content">
                                    <p>
                                    <strong>${comment.author}</strong> <small>${new Date(comment.time).toLocaleString()}</small>
                                    <br>
                                    ${comment.message}
                                    </p>
                                </div>
                            </div>
                            <div class="media-right">
                                <button class="delete comment-delete" data-num="${comment.numComment}"></button>
                            </div>
                        </article>
                    `);
                }
                addListenerToComment();

                $('.black-bg').addClass('show-modal');
            },
            error: function(req, status, error) {
                alert(req.responseText);
            } 
        });
            
    });
}
addListenerToNote();
// 각 노트 닫기
$('#each-note-close').on('click', function() {
    $('.black-bg').removeClass('show-modal');
});
$('.black-bg').on('click', function(e) {
    if(e.target.matches('.black-bg')) {
        $('.black-bg').removeClass('show-modal');
    }
});

// 새로운 노트 추가
$('#add-note').on('click', function() {
    initialize();
    $('.black-bg').addClass('show-modal');
});
$('#each-note-create').on('click', function() {
    if(!$('#each-note-title').val() || !$('#each-note-mention').val() || !$('#each-note-message').val()) {
        alert("fill all data");
        return;
    }
    const note = {
        numNote: 0,
        title: $('#each-note-title').val(),
        mentioned: $('#each-note-mention').val().split(',').map(s => s.trim()),
        author: $('#username').data('me'),
        message: $('#each-note-message').val(),
        readUsers: [],
        time: new Date().getTime()
    };
    $.ajax({
        url: "./add_note",
        type: "POST",
        data: note,
        success: function(data) {
            // 화면에 추가하고 listener 세팅
            $('.notes').prepend(`
                <div class="each-note" data-num=${data} data-author=${note.author}>
                    <p class="note-title">${note.title}</p>
                    <p class="note-mention">${note.mentioned.map(s => '@'+s).join(', ')}</p>
                </div>
            `);
            addListenerToNote();
            // 안읽음/언급됨 업데이트
            $('#not-read-counter').text(parseInt($('#not-read-counter').text())+1);
            if(note.mentioned.includes($('#username').data('me'))) $('#mentioned-counter').text(parseInt($('#mentioned-counter').text())+1);

            $('#each-note-close').click();
        },
        error: function(req, status, error) {
            alert(req.responseText);
        } 
    });
});

// 각 노트 수정 기능 활성화
$('#each-note-modify').on('click', async function() {
    $.ajax({
        url: './can_change_note?num='+$('#each-note-detail').data('num'),
        type: 'GET',
        success: function(data) {
            make_editable();
        },
        error: function(req, status, error) {
            alert(req.responseText);
        }
    });
});
// 각 노트 수정 및 삭제하기
$('#each-note-save').on('click', function() {
    const numNote = $('#each-note-detail').data('num');
    // 노트 삭제
    if($('#check-delete').is(':checked')) {
        $.ajax({
            url: './delete_note?num='+numNote,
            type: 'GET',
            success: async function(data) {
                $(`.each-note[data-num='${numNote}']`).first().remove();
                // 언급 개수 변경
                const res = await $.get('./mentioned_note');
                $('#mentioned-counter').text(res.notes.length);
                $('#each-note-close').click();
            },
            error: function(req, status, error) {
                alert(req.responseText);
            }
        });
        return;
    }
    // 노트 수정
    const note = {
        title: $('#each-note-title').val(),
        mentioned: $('#each-note-mention').val().split(',').map(s => s.trim()),
        message: $('#each-note-message').val(),
        readUsers: [],
        time: new Date().getTime()
    };
    $.ajax({
        url: './change_note?num='+numNote,
        type: 'POST',
        data: note,
        success: async function(data) {
            // 화면 노트 변경
            $(`.each-note[data-num='${numNote}'] .note-title`).text($('#each-note-title').val());
            $(`.each-note[data-num='${numNote}'] .note-mention`).text(note.mentioned.map(s => '@'+s).join(', '));
            // 안읽음 처리
            $(`.each-note[data-num='${numNote}']`).removeClass('note-read');
            $('#not-read-counter').text(parseInt($('#not-read-counter').text())+1);
            // 언급 개수 변경
            const res = await $.get('./mentioned_note');
            $('#mentioned-counter').text(res.notes.length);
            $('#each-note-close').click();
        },
        error: function(req, status, error) {
            alert(req.responseText);
        }
    })
});
// 안 읽은 노트들
$('#not-read').on('click', function() {
    $.ajax({
        url: './notread_note',
        type: 'GET',
        success: function(data) {
            $('.notes').html('');
            for(var note of data.notes) {
                var note_class = (note.readUsers.includes($('#username').data('me'))) ? "each-note note-read" : "each-note";
                $('.notes').prepend(`
                    <div class="${note_class}" data-num=${note.numNote} data-author=${note.author}>
                        <p class="note-title">${note.title}</p>
                        <p class="note-mention">${note.mentioned.map(s => '@'+s).join(', ')}</p>
                    </div>
                `);
            }
            addListenerToNote();
        },
        error: function(req, status, error) {
            alert(req.responseText);
        }
    });
});
// 언급된 노트들
$('#mentioned').on('click', function() {
    $.ajax({
        url: './mentioned_note',
        type: 'GET',
        success: function(data) {
            $('.notes').html('');
            for(var note of data.notes) {
                var note_class = (note.readUsers.includes($('#username').data('me'))) ? "each-note note-read" : "each-note";
                $('.notes').prepend(`
                    <div class="${note_class}" data-num=${note.numNote} data-author=${note.author}>
                        <p class="note-title">${note.title}</p>
                        <p class="note-mention">${note.mentioned.map(s => '@'+s).join(', ')}</p>
                    </div>
                `);
            }
            addListenerToNote();
        },
        error: function(req, status, error) {
            alert(req.responseText);
        }
    })
});
// 노트 찾기 (제목 + 내용)
$('#search-note').on('keypress', function(e) {
    if(e.key !== 'Enter') return;
    
    e.preventDefault();
    $.ajax({
        url: './search_note',
        type: 'POST',
        data: {keyword: $(this).val()},
        success: function(data) {
            $('.notes').html('');
            for(var note of data.notes) {
                var note_class = (note.readUsers.includes($('#username').data('me'))) ? "each-note note-read" : "each-note";
                $('.notes').prepend(`
                    <div class="${note_class}" data-num=${note.numNote} data-author=${note.author}>
                        <p class="note-title">${note.title}</p>
                        <p class="note-mention">${note.mentioned.map(s => '@'+s).join(', ')}</p>
                    </div>
                `);
            }
            addListenerToNote();
        },
        error: function(req, status, error) {
            alert(req.responseText);
        }
    });
});
// 댓글 추가
$('#add-comment').on('click', function() {
    $.ajax({
        url: './add_comment',
        type: 'POST',
        data: {numNote: $('#each-note-detail').data('num'), comment: $('#input-comment').val(), time: new Date().getTime()},
        success: function(data) {
            $('.comment-container').append(`
                <article class="media comment">
                    <figure class="media-left">
                        <p class="image is-64x64">
                            <img src="/my_ISOT/public/pictures/${data.uid}.jpg" 
                                onerror="this.onerror=null; 
                                    this.src='/my_ISOT/public/pictures/${data.uid}.png';
                                    this.onerror=(function() {
                                        this.onerror=null; 
                                        this.src='/my_ISOT/public/pictures/${data.uid}.jpeg';
                                    })"
                            >
                        </p>
                    </figure>
                    <div class="media-content">
                        <div class="content">
                            <p>
                            <strong>${data.author}</strong> <small>${new Date(data.time).toLocaleString()}</small>
                            <br>
                            ${data.message}
                            </p>
                        </div>
                    </div>
                    <div class="media-right">
                        <button class="delete comment-delete" data-num="${data.numComment}"></button>
                    </div>
                </article>
            `);
            addListenerToComment();
        },
        error: function(req, status, error) {
            alert(req.responseText);
        }
    });
    $('#input-comment').val('');
});
$('#input-comment').on('keypress', function(e) {
    if(e.key !== 'Enter') return;
    
    e.preventDefault();
    $('#add-comment').click();
})


function addListenerToMemo() {
    $('.each-memo textarea').on('focusout', function() {
        const data = {
            numMemo: parseInt($(this).data('num')),
            message: $(this).val()
        };
        $.ajax({
            url: './change_memo',
            type: 'POST',
            data: data,
            error: function(req, status, error) {
                alert(req.responseText);
            }
        })
    });
    $('.each-memo button').on('click', function() {
        const deletedMemo = $(this).parent();
        $.ajax({
            url: './delete_memo?num='+$(this).siblings('textarea').data('num'),
            type: 'GET',
            success: function(data) {
                deletedMemo.remove();
            },
            error: function(req, status, error) {
                alert(req.responseText);
            }
        })
    });
}
addListenerToMemo();

$('#add-memo').on('click', function() {
    $.ajax({
        url: './add_memo',
        type: 'GET',
        success: function(data) {
            $('.memos').append(`
                <div class="each-memo">
                    <textarea class="textarea" placeholder="Add new memo" data-num=${data}></textarea>
                    <button class="delete is-large"></button>
                </div>
            `);
            addListenerToMemo();
        },
        error: function(req, status, error) {
            alert(req.responseText);
        }
    });
});

$('#search-memo').on('keypress', function(e) {
    if(e.key !== 'Enter') return;
    
    e.preventDefault();
    $.ajax({
        url: './search_memo',
        type: 'POST',
        data: {keyword: $(this).val()},
        success: function(data) {
            $('.memos').html('');
            for(var memo of data.memos) {
                $('.memos').append(`
                    <div class="each-memo">
                        <textarea class="textarea" placeholder="Add new memo" data-num=${memo.numMemo}>${memo.message}</textarea>
                        <button class="delete is-large"></button>
                    </div>
                `);
            }
            addListenerToMemo();
        },
        error: function(req, status, error) {
            alert(req.responseText);
        }
    });
});