$('#pw-same').hide();
$('.fas.fa-check').hide();

// pw 일치 테스트
$('#pw-new').on('input', function() {
    if($(this).val().trim() !== $('#pw-check').val().trim()) {
        $('#pw-same').show();
        $('.fas.fa-check').hide();
    } else {
        $('#pw-same').hide();
        $('.fas.fa-check').show();
    }
});
$('#pw-check').on('input', function() {
    if($(this).val().trim() !== $('#pw-new').val().trim()) {
        $('#pw-same').show();
        $('.fas.fa-check').hide();
    } else {
        $('#pw-same').hide();
        $('.fas.fa-check').show();
    }
});


// 업로드 시 파일 제목 보여주기
$('#profile').on('change', function() {
    var filename = $(this).val().split('\\').pop();
    $('.file-name').text(filename);
});


// signup 버튼 
$('#save').on('click', async function() {
    var pw_org = $('#pw-org').val().trim();
    var pw_val = $('#pw-new').val().trim();
    var pwcheck_val = $('#pw-check').val().trim();
    var username_val = $('#username-new').val();
    var userinfo_val = $('#userinfo-new').val();
    var profile_val = $('#profile').val();

    // 입력값 검증
    if(!pw_val || !username_val || !userinfo_val || !profile_val) {
        alert('fill all info');
        return;
    }
    if(pw_val !== pwcheck_val) {
        alert('check pw again');
        return;
    }
    if(profile_val.split(".").pop()!=="png" && profile_val.split(".").pop()!=="jpg") {
        alert('profile should be jpg/png');
        return;
    }

    try {
        const res = await $.ajax({
            type: 'POST',
            url: '/change_info',
            data: {pw: pw_org, newpw: pw_val, username: username_val, userinfo: userinfo_val}
        });

        var formData = new FormData();
        formData.append('profile', $('#profile')[0].files[0]);

        await $.ajax({
            // AJAX를 이용한 파일 전송 시 FormData 객체 사용
            // contentType: false 함으로써 서버가 데이터 타입 자동으로 결정하는 것 방지
            // processData: false 함으로써 직렬화 방지
            type: 'POST',
            url: '/upload?_id='+res._id,
            data: formData,
            processData: false,
            contentType: false
        });

        alert('Changes has been applied');
        window.location.href = '/';
    } catch(err) {
        alert(err.responseText);
    }
});
