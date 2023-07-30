$('#login').on('click', function() {
    var id_val = $('#id').val().trim();
    var pw_val = $('#pw').val().trim();

    // 입력값 검증
    if(!id_val || !pw_val) {
        alert("enter id/pw correctly!");
        window.location.href = './login';
        return;
    }

    // POST 요청
    $.ajax({
        method: 'POST',
        url: './login',
        data: {id: id_val, pw: pw_val},
        success: function(res) {
            window.location.href = './';
        },
        error: function(req, status, err){
            alert(req.responseText);
            window.location.href = './login';
        }
    });
});

// Enter 누르면 로그인 시도
$('#pw').on('keypress', function(e) {
    if(e.key === 'Enter') {
        e.preventDefault();
        $('#login').click();
    }
});