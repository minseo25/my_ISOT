// 환경변수 .env에 저장
require('dotenv').config();

// express 라이브러리 사용
const express = require('express');
const app = express();

// POST 요청 데이터 해석
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended: true}));

// EJS 파일 사용
app.set('view engine', 'ejs');

// static file(css 등) 보관 위해 /public 폴더 사용
app.use('/public', express.static('public'));

// pw DB에 저장 시 암호화
const bcrypt = require('bcrypt');
const saltRounds = 10;

// 웹소켓 이용한 통신
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);

// 이미지(multipart data) 처리 작업 위해
const multer = require('multer');
const path = require('path');

// DB 연결 (mongodb 5.0.0 ver 사용해보자 5.5.0 대신)
const { MongoClient, ServerApiVersion } = require('mongodb');
const client = new MongoClient(process.env.DB_URL, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: false,
      deprecationErrors: true,
    }
});
var db;
async function run() {
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        // connect to db
        db = client.db('isot');
        // 특정 포트번호로 서버 띄우기
        http.listen(process.env.PORT, function() {
            console.log('listening on '+process.env.PORT);
        })
    } catch(err) {
        console.log(err);
        // Ensures that the client will close when you finish/error
        await client.close();
    }
}
run().catch(console.dir);

// session-based authentication
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const { title } = require('process');
app.use(session({secret: "minseo", resave: true, saveUninitialized: false}));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy({
    usernameField: 'id',
    passwordField: 'pw',
    session: true,
    passReqToCallback: false
}, async (userid, userpw, done) => {
    try {
        // check if id already exists
        const result = await db.collection('users').findOne({id: userid});

        if(!result) return done(null, false, {msg: 'ID doesn\'t exist'});
        bcrypt.compare(userpw, result.pw, (err, same) => {
            if(err) return done(err);
            if(same) return done(null, result);
            else return done(null, false, {msg: 'Incorrect Password'});
        });
    } catch(err) {
        return done(err);
    }
}));
// user.id로 세션 생성 후 저장
passport.serializeUser((user, done) => {
    done(null, user.id);
});
// 세션값으로부터 사용자 정보를 불러옴
passport.deserializeUser(async (uid, done) => {
    const result = await db.collection('users').findOne({id: uid});
    done(null, result);
});

// 페이지 접속 전 실행시킬 미들웨어 checkLogin
function checkLogin(req, res, next) {
    if(req.user) {
        // 로그인 된 상태에서 접속하면 안 되는 페이지들
        if(req.path==='/login' || req.path === '/signup') return res.redirect('/');
        else return next();
    } else {
        // 로그인 안 된 상태에서도 접속할 수 있는 페이지들
        if(req.path === '/login' || req.path === '/signup' || req.path === '/upload') return next();
        // 그 외
        res.redirect('/login');
    }
}
app.use(checkLogin);


// 로그인 페이지
app.get('/login', function(req, res) {
    res.render('login.ejs');
});
app.post('/login', function(req, res, next) {
    // 사용자 콜백 지정하여 성공/실패 처리 (https://velog.io/@kdo0129/Passport로-로그인-구현하기)
    passport.authenticate('local', function(err, user, info) {
        if(err) return next(err);
        if(!user) return res.status(400).send(info.msg);
        req.logIn(user, function(err) {
            if(err) return next(err);
            return res.status(200).send('login success');
        });
    })(req, res, next);
});


// 로그아웃 페이지
app.get('/logout', function(req, res) {
    req.logout(err => {
        if(err) return next(err);
        else {
            console.log('logout complete');
            res.redirect('/login');
        }
    })
});


// 회원가입 페이지
app.get('/signup', function(req, res) {
    res.render('signup.ejs');
});
app.post('/signup', async function(req, res) {
    try {
        const user = await db.collection('users').findOne({id: req.body.id});
        if(user) {
            res.status(400).send('ID already exists');
            return;
        }
        const messages = await db.collection('chatmessages').find().toArray();
        bcrypt.hash(req.body.pw, saltRounds, async (err, hash) => {
            if(err) {
                res.status(500).send('Server Error');
            } else {
                await db.collection('users').insertOne({
                    id: req.body.id,
                    pw: hash,
                    username: req.body.username,
                    userinfo: req.body.userinfo,
                    notread: messages.length
                });
                const result = await db.collection('users').findOne({id: req.body.id});
                res.status(200).json({_id: result._id});
            }
        });
    } catch(err) {
        console.log(err);
        res.status(500).send('Server Error');
    }
});


// 파일 저장과 관련된 옵션
var diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        // 서버의 root directory 기준 저장 경로 지정
        cb(null, './public/pictures/');
    },
    filename: (req, file, cb) => {
        // _id 값으로 파일명 세팅
        let orgExt = path.parse(file.originalname).ext;
        cb(null, req.query._id+orgExt);
    }
})
var upload = multer({
    storage: diskStorage,
    limit: {fileSize: 3*1024*1024} // file size 제한 = 3MB
});
app.post('/upload', upload.single('profile'), (req,res) => {
    res.status(200).send();
});


// 인덱스 페이지
app.get('/', async function(req,res) {
    try {
        req.user._id = req.user._id.toString();
        const memos = await db.collection('memos').find().toArray();
        const notes = await db.collection('notes').find().toArray();
        notes.reverse();
        const mentioned = await db.collection('notes').find({mentioned: req.user.username}).toArray();
        const notread = await db.collection('notes').find({readUsers: {$ne: req.user.username}}).toArray();
        
        res.render('index.ejs', {user: req.user, memos: memos, notes: notes, mentioned: mentioned.length, notread: notread.length});
    } catch {
        res.render('index.ejs', {user: req.user, memos: [], notes: [], mentioned: [], notread: []});
    }
});


// 회원정보 변경 페이지
app.get('/change_info', function(req, res) {
    req.user._id = req.user._id.toString();
    res.render('change_info.ejs', {user: req.user});
});
app.post('/change_info', async function(req, res) {
    try {
        // pw 올바른지 검증
        const user = await db.collection('users').findOne({id: req.user.id});
        const match = await bcrypt.compare(req.body.pw, user.pw);
        if(!match) return res.status(400).send('Incorrect Password');

        // 정보 업데이트
        const encryptedpw = await bcrypt.hash(req.body.newpw, saltRounds);
        await db.collection('users').updateOne({id: req.user.id}, {$set: {
            pw: encryptedpw,
            username: req.body.username,
            userinfo: req.body.userinfo 
        }});
        res.status(200).json({_id: user._id});
    } catch(err) {
        console.log(err);
        res.status(500).send('Server Error');
    }
});


// 채팅방
app.get('/chat', async function(req, res) {
    try {
        req.user._id = req.user._id.toString();
        const messages = await db.collection('chatmessages').find().toArray();
        res.render('chat.ejs', {user: req.user, chats: messages});
    } catch(err) {
        console.log(err);
        res.render('chat.ejs', {user: req.user, chats: null});
    }
});


// 안읽은 메시지 생길때마다 1 증가
app.get('/unread', async function(req, res) {
    try {
        await db.collection('users').updateMany({id: {$ne: req.user.id}}, {$inc: {notread: 1}});
        res.status(200).send();
    } catch(err) {
        console.log(err);
        res.status(500).send();
    }
});
// 전부 읽었을 때
app.get('/unread_clear', async function(req, res) {
    try {
        await db.collection('users').updateOne({id: req.user.id}, {$set: {
            notread: 0
        }});
        res.status(200).send();
    } catch(err) {
        console.log(err);
        res.status(500).send();
    }
});


// socket을 이용한 실시간 양방향 통신
io.on('connection', (socket) => {
    socket.on('group-chat', async (data) => {
        try {
            await db.collection('chatmessages').insertOne(data);
            io.emit('message', data);
        } catch (err) {
            console.log(err);
            io.emit('message', null);
        }
    })
});


// 노트 새로 추가
app.post('/add_note', async function(req, res) {
    try {
        await db.collection('counter').updateOne({name: "numNotes"}, {$inc: {numNotes: 1}});
        const counter = await db.collection('counter').findOne({name: "numNotes"});

        var note = req.body;
        note.numNote = counter.numNotes;
        note.readUsers = [];
        note.time = parseInt(note.time);
        
        await db.collection('notes').insertOne(note);
        res.status(200).send(counter.numNotes.toString());
    } catch(err) {
        console.log(err);
        res.status(500).send("Server Error");
    }
});
// 노트 내용 확인
app.get('/get_note', async function(req, res) {
    try {
        const result = await db.collection('notes').findOne({numNote: parseInt(req.query.num)});
        // 읽은 노트에 추가
        const readUsers = result.readUsers;
        if(!readUsers.includes(req.user.username)) {
            readUsers.push(req.user.username);
            await db.collection('notes').updateOne({numNote: parseInt(req.query.num)}, {$set: {readUsers: readUsers}});
        }
        const comments = await db.collection('comments').find({numNote: parseInt(req.query.num)}).toArray();
        
        res.status(200).json({note: result, comments: comments});
    } catch(err) {
        console.log(err);
        res.status(500).send("Server Error");
    }
});
// 노트 수정 가능한지 확인
app.get('/can_change_note', async function(req, res) {
    try {
        const result = await db.collection('notes').findOne({numNote: parseInt(req.query.num)}); 
        if(result.author === req.user.username) res.status(200).send();
        else res.status(400).send("No Permission");
    } catch(err) {
        console.log(err);
        res.status(500).send("Server Error");
    }
});
// 노트 내용 수정
app.post('/change_note', async function(req, res) {
    try {
        await db.collection('notes').updateOne({numNote: parseInt(req.query.num)}, {$set: {
            title: req.body.title,
            mentioned: req.body.mentioned,
            message: req.body.message,
            time: parseInt(req.body.time),
            readUsers: []
        }});
        res.status(200).send();
    } catch(err) {
        console.log(err);
        res.status(500).send("Server Error");
    }
});
// 노트 삭제 처리 (+ 하위 댓글도)
app.get('/delete_note', async function(req, res) {
    try {
        await db.collection('notes').deleteOne({numNote: parseInt(req.query.num)});
        await db.collection('comments').deleteMany({numNote: parseInt(req.query.num)});
        res.status(200).send();
    } catch(err) {
        console.log(err);
        res.status(500).send("Server Error");
    }
});
// 안읽은 노트들
app.get('/notread_note', async function(req, res) {
    try {
        const notread = await db.collection('notes').find({readUsers: {$ne: req.user.username}}).toArray();
        res.status(200).json({notes: notread});
    } catch(err) {
        console.log(err);
        res.status(500).send("Server Error");
    }
});
// 언급된 노트들
app.get('/mentioned_note', async function(req, res) {
    try {
        const mentioned = await db.collection('notes').find({mentioned: req.user.username}).toArray();
        res.status(200).json({notes: mentioned});
    } catch(err) {
        console.log(err);
        res.status(500).send("Server Error");
    }
});
// 노트 검색
app.post('/search_note', async function(req, res) {
    try {
        var searched_notes, titleMatches, messageMatches;
        if(req.body.keyword === '') {
            searched_notes = await db.collection('notes').find().toArray();
            res.status(200).json({notes: searched_notes});
        } else {
            titleMatches = await db.collection('notes').find({"title": {$regex: req.body.keyword, $options: 'i'}}).toArray();
            messageMatches = await db.collection('notes').find({"message": {$regex: req.body.keyword, $options: 'i'}}).toArray();
            // 제목 검색값과 내용 검색값 합집합 구하기
            for(var ele of messageMatches) {
                if(!titleMatches.some(e => e.numNote === ele.numNote)) titleMatches.push(ele);
            }
            titleMatches.sort((a,b) => (a.numNote - b.numNote));
            res.status(200).json({notes: titleMatches});
        }
    } catch(err) {
        console.log(err);
        res.status(500).send("Server Error");
    }
});
// 댓글 추가
app.post('/add_comment', async function(req, res) {
    try {
        await db.collection('counter').updateOne({name: "numComments"}, {$inc: {numComments: 1}});
        const counter = await db.collection('counter').findOne({name: "numComments"});

        const data = {
            numNote: parseInt(req.body.numNote),
            uid: req.user._id.toString(),
            author: req.user.username,
            message: req.body.comment,
            time: parseInt(req.body.time),
            numComment: counter.numComments
        };
        await db.collection('comments').insertOne(data);
        res.status(200).json(data);
    } catch(err) {
        console.log(err);
        res.status(500).send("Server Error");
    }
});
// 댓글 삭제
app.get('/delete_comment', async function(req, res) {
    try {
        const result = await db.collection('comments').findOne({numComment: parseInt(req.query.num)});
        if(result.author !== req.user.username) {
            res.status(400).send("No Permission");
            return;
        }
        await db.collection('comments').deleteOne({numComment: parseInt(req.query.num)});
        res.status(200).send();
    } catch(err) {
        console.log(err);
        res.status(500).send("Server Error");
    }
});



// 메모 새로 추가
app.get('/add_memo', async function(req, res) {
    try {
        await db.collection('counter').updateOne({name: "numMemos"}, {$inc: {numMemos: 1}});
        const counter = await db.collection('counter').findOne({name: "numMemos"});

        await db.collection('memos').insertOne({numMemo: counter.numMemos, message: ''});
        res.status(200).send(counter.numMemos.toString());
    } catch(err) {
        console.log(err);
        res.status(500).send("Server Error");
    }
});
// 메모 내용 수정
app.post('/change_memo', async function(req, res) {
    try {
        await db.collection('memos').updateOne({numMemo: parseInt(req.body.numMemo)}, {$set: {message: req.body.message}});
        res.status(200).send();
    } catch(err) {
        console.log(err);
        res.status(500).send("Server Error");
    }
});
// 메모 삭제
app.get('/delete_memo', async function(req, res) {
    try {
        await db.collection('memos').deleteOne({numMemo: parseInt(req.query.num)});
        res.status(200).send();
    } catch(err) {
        console.log(err);
        res.status(500).send("Server Error");
    }
});
// 메모 검색
app.post('/search_memo', async function(req, res) {
    try {
        var searched_memos;
        if(req.body.keyword === '') {
            searched_memos = await db.collection('memos').find().toArray();
        } else {
            searched_memos = await db.collection('memos').find({"message": {$regex: req.body.keyword, $options: 'i'}}).toArray();
        }

        res.status(200).json({memos: searched_memos});
    } catch(err) {
        console.log(err);
        res.status(500).send("Server Error");
    }
});

// 메모장
app.get('/memo', function(req, res) {
    req.user._id = req.user._id.toString();
    res.render('memo.ejs', {user: req.user});
})

// 스케쥴표
app.get('/schedule', function(req, res) {
    req.user._id = req.user._id.toString();
    res.render('schedule.ejs', {user: req.user});
});