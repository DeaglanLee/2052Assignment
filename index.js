const express = require('express');
const app = express();
const path = require('path');
const mysql = require('mysql2/promise');
let sessions = require('express-session');
const port = 3000
const hour = 3600000; //miliseconds in 1 hour

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: `assignment`,
    port: '3306',
};

// app.use
app.use(sessions({
    secret: "somethingsecret",
    saveUninitialized: true,
    cookie: { maxAge: hour },
    resave: false
}))

app.use(express.static(path.join(__dirname, '/public')));
app.use(express.urlencoded({ extended: true }));
app.use(async (req, res, next) => {
    let sess_obj = req.session;
    const connection = await mysql.createConnection(dbConfig);

    if (sess_obj.username) {
        try {
            const [user] = await connection.query(`SELECT * FROM users WHERE username = '${sess_obj.username}'`);

            if (user.length > 0) {
                sess_obj.isLoggedIn = true;
                sess_obj.username = user[0].username;
            } else {
                sess_obj.destroy();
                sess_obj.isLoggedIn = false;
            }
        } catch (error) {
            console.error('Error retrieving user from the database:', error);
            sess_obj.isLoggedIn = false;
        }
    } else {
        sess_obj.isLoggedIn = false;
    }
    next();
});


app.set('view engine', 'ejs');


// app.gets
app.get('/', async (req, res) => {
    let title = "Home";
    let sess_obj = req.session;
    try {
        res.render("pages/landing", { titledata: title, user: sess_obj.username, loggedIn: sess_obj.isLoggedIn, baseUrl: req.baseUrl })
    } catch (error) {
        sess_obj.isLoggedIn = false;
        res.render("pages/landing", { titledata: title, loggedIn: sess_obj.isLoggedIn, baseUrl: req.baseUrl })
    }
});

app.get('/cards', async (req, res) => {
    let sess_obj = req.session;
    let title = "Cards";
    let getCards = `SELECT c.*, s.name AS seriesName FROM card AS c INNER JOIN series AS s ON c.setId = s.setId;`;
    let getSeries = `SELECT DISTINCT name FROM series`
    let getSets = `SELECT DISTINCT setId FROM series`
    const connection = await mysql.createConnection(dbConfig);
    try {
        let cardResult = await connection.query(getCards);
        let seriesResult = await connection.query(getSeries);
        let setsResult = await connection.query(getSets);
        res.render("pages/cards", {
            titledata: title,
            user: sess_obj.username,
            loggedIn: sess_obj.isLoggedIn,
            cards: cardResult[0],
            cardNumber: cardResult[0].length,
            series: seriesResult[0],
            sets: setsResult[0],
            baseUrl: req.baseUrl,
            webpage: 'cards',
        });
    } catch (error) {
        sess_obj.isLoggedIn = false;
        console.log(error.message)
        res.redirect("/")
    }
});

app.get('/signup', (req, res) => {
    let sess_obj = req.session;
    let title = "Sign Up!!";
    res.render('pages/signup', { titledata: title, loggedIn: sess_obj.isLoggedIn, user: sess_obj.username, baseUrl: req.baseUrl });
});

app.get('/login', (req, res) => {
    let sess_obj = req.session;
    let title = "Log In!!";
    res.render('pages/login', { titledata: title, loggedIn: sess_obj.isLoggedIn, user: sess_obj.username, baseUrl: req.baseUrl });
});

app.get('/logout', (req, res) => {
    let sess_obj = req.session;
    sess_obj.destroy();
    res.redirect("/")
});

app.get('/dashboard', async (req, res) => {
    let sess_obj = req.session;
    if (sess_obj.username) {
        let title = `${sess_obj.username}`;
        res.render("pages/dashboard", { titledata: title, user: sess_obj.username, loggedIn: sess_obj.isLoggedIn });
    }
    else {
        res.redirect("/")
    }
});

app.get('/profile/:username', async (req, res) => {
    let sess_obj = req.session;
    const username = req.params.username;

    const connection = await mysql.createConnection(dbConfig);

    try {
        let userResult = await connection.query('SELECT id FROM users WHERE username = ?', username);
        let collectionResult = await connection.query('SELECT DISTINCT collectionId, collectionName from collection INNER JOIN users WHERE collection.userId = ?', userResult[0][0].id);
        let title = `${username}`
        if (sess_obj.username) {
            res.render('pages/dashboard', {
                titledata: title,
                user: sess_obj.username,
                pageUser: username,
                loggedIn: sess_obj.isLoggedIn,
                baseUrl: req.baseUrl,
                cardCollection: collectionResult[0]
            });
        } else {
            res.render('pages/dashboard', {
                titledata: title,
                user: sess_obj.username,
                pageUser: username,
                loggedIn: sess_obj.isLoggedIn,
                baseUrl: req.baseUrl,
                cardCollection: collectionResult[0]
            });
        }
    } catch (error) {
        res.redirect('/')
    }
});

app.get('/profile/:username/collection', async (req, res) => {
    let sess_obj = req.session;
    const username = req.params.username;
    let getCards = `SELECT c.*, s.name AS seriesName FROM card AS c INNER JOIN series AS s ON c.setId = s.setId;`;
    let getSeries = `SELECT DISTINCT name FROM series`
    let getSets = `SELECT DISTINCT setId FROM series`

    const connection = await mysql.createConnection(dbConfig);

    try {
        let userResult = await connection.query('SELECT * FROM users WHERE username = ?', [username]);
        let cardResult = await connection.query(getCards);
        let seriesResult = await connection.query(getSeries);
        let setsResult = await connection.query(getSets);
        if (sess_obj.username === userResult[0][0].username) {
            let title = `${sess_obj.username}`
            res.render('pages/collection', {
                titledata: title,
                user: sess_obj.username,
                pageUser: username,
                loggedIn: sess_obj.isLoggedIn,
                cards: cardResult[0],
                cardNumber: cardResult[0].length,
                series: seriesResult[0],
                sets: setsResult[0],
                baseUrl: req.baseUrl,
                webpage: 'collection',
                cardCollection: 'undefined'
            });
        } else {
            res.redirect('/')
        }
    } catch (error) {
        res.redirect('/')
    }
});

app.get('/profile/:username/collection/:id', async (req, res) => {
    let sess_obj = req.session;
    const username = req.params.username;
    const collectionId = req.params.id;
    let getCards = `SELECT DISTINCT collection.collectionId, collection.collectionName, card.*, series.name AS seriesName FROM collection INNER JOIN users ON collection.userId = users.Id INNER JOIN item ON collection.collectionId = item.collectionId INNER JOIN card ON item.itemId = card.id INNER JOIN series ON series.setId = card.setId WHERE collection.collectionId = (?) AND collection.userId = (?)`;
    let getSeries = `SELECT DISTINCT name FROM series`
    let getSets = `SELECT DISTINCT setId FROM series`

    const connection = await mysql.createConnection(dbConfig);

    try {
        let userResult = await connection.query('SELECT * FROM users WHERE username = ?', [username]);
        let collectionResult = (await connection.query('SELECT DISTINCT collectionId, collectionName from collection INNER JOIN users WHERE collection.collectionId = (?) AND collection.userId = (?);', [collectionId, userResult[0][0].id]));
        if (collectionResult[0].length > 0) {
            let cardResult = await connection.query(getCards, [collectionId, userResult[0][0].id]);
            let seriesResult = await connection.query(getSeries);
            let setsResult = await connection.query(getSets);
            let title = `${username}`

            res.render('pages/collection', {
                titledata: title,
                user: sess_obj.username,
                pageUser: username,
                loggedIn: sess_obj.isLoggedIn,
                cards: cardResult[0],
                cardNumber: cardResult[0].length,
                series: seriesResult[0],
                sets: setsResult[0],
                baseUrl: req.baseUrl,
                webpage: 'collection',
                cardCollection: collectionResult[0][0]
            });
        } else {
            res.redirect(`/profile/${username}`)
        }
    } catch (error) {
        res.redirect('/')
    }
});

app.get('/profile/:username/collection/:id/addcard', async (req, res) => {
    let sess_obj = req.session;
    const username = req.params.username;
    const collectionId = req.params.id;

    let getCards = `SELECT c.*, s.name AS seriesName FROM card AS c INNER JOIN series AS s ON c.setId = s.setId WHERE c.id NOT IN (SELECT itemId FROM item WHERE collectionId = (?));`;
    let getSeries = `SELECT DISTINCT name FROM series`
    let getSets = `SELECT DISTINCT setId FROM series`

    const connection = await mysql.createConnection(dbConfig);

    try {
        if (sess_obj.username === username) {
            let userResult = await connection.query('SELECT * FROM users WHERE username = ?', [username]);
            let collectionResult = await connection.query('SELECT DISTINCT collectionId, collectionName from collection INNER JOIN users WHERE username = (?) AND collectionId = (?)', [userResult[0][0].username, collectionId]);
            if (collectionResult[0].length > 0) {
                let cardResult = await connection.query(getCards, collectionResult[0][0].collectionId);
                let seriesResult = await connection.query(getSeries);
                let setsResult = await connection.query(getSets);
                let title = `${username}`
                res.render('pages/collection', {
                    titledata: title,
                    user: sess_obj.username,
                    pageUser: username,
                    loggedIn: sess_obj.isLoggedIn,
                    cards: cardResult[0],
                    cardNumber: cardResult[0].length,
                    series: seriesResult[0],
                    sets: setsResult[0],
                    baseUrl: req.baseUrl,
                    webpage: 'addCard',
                    cardCollection: collectionResult[0][0]
                });
            } else {
                res.redirect(`/profile/${username}`)
            }
        }else{
            res.redirect(`/profile/${username}`)
        }
    } catch (error) {
        res.redirect('/')
    }
});

app.get('/searchCards', async (req, res) => {
    const userInput = req.query.searchInput || '';
    const sqlQuery = `
      SELECT name, illustrator
      FROM card
      WHERE name LIKE '%${userInput}%' OR location LIKE '%${userInput}%';
    `;

    const connection = await mysql.createConnection(dbConfig);

    try {
        const [searchResult] = await connection.query(sqlQuery);
        res.render('pages/cards', { titledata: 'Cards', user: req.session.username, loggedIn: req.session.isLoggedIn, cards: searchResult, cardNumber: searchResult.length });
    } catch (error) {
        console.error('Error during search:', error);
        res.status(500).send("Internal Server Error");
    } finally {
        await connection.end();
    }
});

app.get('/profile/:username/settings', async (req, res) => {
    let sess_obj = req.session;
    const username = req.params.username;

    const connection = await mysql.createConnection(dbConfig);

    try {
        if (sess_obj.username === username) {
            let userResult = await connection.query('SELECT * FROM users WHERE username = ?', [username]);
            if (userResult[0].length > 0) {
                let title = `${username}`
                res.render('pages/settings', {
                    titledata: title,
                    user: sess_obj.username,
                    pageUser: userResult[0],
                    loggedIn: sess_obj.isLoggedIn,
                    baseUrl: req.baseUrl
                });
            } else {
                res.redirect(`/profile/${username}`)
            }
        } else {
            res.redirect(`/profile/${username}`)
        }
    } catch (error) {
        res.redirect('/')
    }
})



//app.posts
app.post("/process", async (req, res) => {
    let sess_obj = req.session;
    let username = req.body.usernameInput;
    let email = req.body.emailInput;
    let password = req.body.passwordInput;

    let sqlInsert = "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";

    const connection = await mysql.createConnection(dbConfig);

    try {
        const result = await connection.query(sqlInsert, [username, email, password]);
        sess_obj.isLoggedIn = true;
        sess_obj.username = username; 
        res.redirect('/');
    } catch (error) {
        res.status(500).send("Internal Server Error");
    } finally {
        await connection.end();
    }
})

app.post('/login', async (req, res) => {
    try {
        let sess_obj = req.session;
        const username = req.body.usernameInput;
        const password = req.body.passwordInput;
        const email = req.body.usernameInput;
        const remember = req.body.rememberCheck;
        const connection = await mysql.createConnection(dbConfig);

        const [user] = await connection.query(`SELECT * FROM users WHERE username = ? OR email = ?`, [username, email || null]);

        if (user.length > 0) {
            if (user[0].password === password) {
                if (remember) {
                    sess_obj.cookie.maxAge = 31556952000 // miliseconds in one year
                }
                // Set isLoggedIn to true in the session
                sess_obj.isLoggedIn = true;
                sess_obj.username = user[0].username; // Store username in the session
                res.redirect('/');
            } else {
                // Password is incorrect
                res.redirect('/login');
            }
        } else {
            // User not found
            res.redirect('/login');
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.redirect('/login');
    }
});


app.post('/createCollection', async (req, res) => {
    const collectionName = req.body.collectionName;
    const username = req.body.userField;
    const sqlInsert = `
      INSERT INTO collection (userId, collectionName) VALUES (?,?)`;
    const sqlQuery = `SELECT id FROM users WHERE username = (?)`;
    const getcollection = 'SELECT collectionId from collection where collectionName = ?'

    const connection = await mysql.createConnection(dbConfig);

    try {
        const userIdResult = await connection.query(sqlQuery, [username]);

        const result = await connection.query(sqlInsert, [userIdResult[0][0].id, collectionName]);
        const collectionResult = await connection.query(getcollection, [collectionName])
        res.redirect(`/profile/${username}/collection/${collectionResult[0][0].collectionId}`);
    } catch (error) {
        console.error('Error:', error);
        res.redirect('/profile/:username/collection');
    } finally {
        await connection.end();
    }
});

app.post('/profile/:profileName/collection/:collectionId/addcard/:cardId', async (req, res) => {
    // parameters variables
    let sess_obj = req.session;
    const profileName = req.params.profileName;
    const collectionId = req.params.collectionId;
    const cardId = req.params.cardId;
    const user = sess_obj.username;

    // sql variables
    const userQuery = `SELECT id FROM users WHERE username = ?`;
    const sqlInsert = `
      INSERT INTO item (collectionId, itemId) VALUES (?,?)`;
    const getcollection = 'SELECT collectionId, userId, collectionName from collection INNER JOIN users where users.id = (?) AND collectionId = (?)'

    // create connection to database
    const connection = await mysql.createConnection(dbConfig);

    try {
        if (user === profileName) {
            // get the userId
            const userIdResult = await connection.query(userQuery, [profileName]);
            // get the collection details which match the userId and the collectionId
            const collectionResult = await connection.query(getcollection, [userIdResult[0][0].id, collectionId])

            // insert the card into the collection
            const result = await connection.query(sqlInsert, [collectionId, cardId]);
            res.redirect(`/profile/${profileName}/collection/${collectionResult[0][0].collectionId}`);
        }
    } catch (error) {
        console.error('Error:', error);
        res.redirect('/profile/:username/collection');
    } finally {
        await connection.end();
    }
});

app.post('/profile/:profileName/collection/:collectionId/deletecard/:cardId', async (req, res) => {
    // parameters variables
    let sess_obj = req.session;
    const profileName = req.params.profileName;
    const collectionId = req.params.collectionId;
    const cardId = req.params.cardId;
    const user = sess_obj.username;

    // sql variables
    const userQuery = `SELECT id FROM users WHERE username = ?`;
    const deleteCard = `DELETE FROM item WHERE item.collectionId = (?) AND item.itemId = (?)`;
    const getcollection = 'SELECT collectionId, userId, collectionName from collection INNER JOIN users where users.id = (?) AND collectionId = (?)'

    // create connection to database
    const connection = await mysql.createConnection(dbConfig);

    try {
        if (user === profileName) {
            const userIdResult = await connection.query(userQuery, [profileName]);
            const collectionResult = await connection.query(getcollection, [userIdResult[0][0].id, collectionId])

            const result = await connection.query(deleteCard, [collectionId, cardId]);
            res.redirect(`/profile/${profileName}/collection/${collectionResult[0][0].collectionId}`);
        }
    } catch (error) {
        console.error('Error:', error);
        res.redirect(`/profile/${profileName}/collection`);
    } finally {
        await connection.end();
    }
});

app.post('/profile/:profileName/settings/updateemail', async (req, res) => {
    // parameters variables
    let sess_obj = req.session;
    const profileName = req.params.profileName;
    const user = sess_obj.username;
    const newEmail = req.body.changeEmail
    if (newEmail.length < 1) {
        res.redirect(`/profile/${profileName}/settings`)
    }

    // sql variables
    const userQuery = `SELECT id FROM users WHERE username = ?`;
    let userEmailUpdateSql = `Update users SET email = (?) WHERE id = (?)`;

    // create connection to database
    const connection = await mysql.createConnection(dbConfig);

    try {
        if (user === profileName) {
            const userIdResult = await connection.query(userQuery, [profileName]);
            const updateEmail = await connection.query(userEmailUpdateSql, [newEmail, userIdResult[0][0].id])

            res.redirect(`/profile/${profileName}/settings`);
        }
    } catch (error) {
        console.error('Error:', error);
        res.redirect(`/profile/${profileName}`);
    } finally {
        await connection.end();
    }
});

app.post('/profile/:profileName/settings/updateusername', async (req, res) => {
    // parameters variables
    let sess_obj = req.session;
    const profileName = req.params.profileName;
    const user = sess_obj.username;
    const newUsername = req.body.changeUsername
    if (newUsername.length < 1) {
        res.redirect(`/profile/${profileName}/settings`)
    }

    // sql variables
    const userQuery = `SELECT id FROM users WHERE username = ?`;
    let userUsernameUpdateSql = `Update users SET username = (?) WHERE id = (?)`;

    // create connection to database
    const connection = await mysql.createConnection(dbConfig);

    try {
        if (user === profileName) {
            const userIdResult = await connection.query(userQuery, [profileName]);
            const updateUsername = await connection.query(userUsernameUpdateSql, [newUsername, userIdResult[0][0].id])

            sess_obj.username = newUsername;
            res.redirect(`/profile/${profileName}/settings`);
        }
    } catch (error) {
        console.error('Error:', error);
        res.redirect(`/profile/${profileName}`);
    } finally {
        await connection.end();
    }
});

app.post('/profile/:profileName/settings/updatepassword', async (req, res) => {
    // parameters variables
    let sess_obj = req.session;
    const profileName = req.params.profileName;
    const user = sess_obj.username;
    const newPassword = req.body.changePassword
    if (newPassword.length < 1) {
        res.redirect(`/profile/${profileName}/settings`)
    }

    // sql variables
    const userQuery = `SELECT id FROM users WHERE username = ?`;
    let userPasswordUpdateSql = `Update users SET password = (?) WHERE id = (?)`;

    // create connection to database
    const connection = await mysql.createConnection(dbConfig);

    try {
        if (user === profileName) {
            const userIdResult = await connection.query(userQuery, [profileName]);
            const updatePassword = await connection.query(userPasswordUpdateSql, [newPassword, userIdResult[0][0].id])

            res.redirect(`/profile/${profileName}/settings`);
        }
    } catch (error) {
        console.error('Error:', error);
        res.redirect(`/profile/${profileName}`);
    } finally {
        await connection.end();
    }
});

app.post('/profile/:profileName/deleteall', async (req, res) => {
    // parameters variables
    let sess_obj = req.session;
    const profileName = req.params.profileName;
    const user = sess_obj.username;
    // sql variables
    const userQuery = `SELECT id FROM users WHERE username = ?`;
    let userDelete = `DELETE FROM users WHERE users.id = ?`;

    // create connection to database
    const connection = await mysql.createConnection(dbConfig);

    try {
        if (user === profileName) {
            const userIdResult = await connection.query(userQuery, [profileName]);
            const updatePassword = await connection.query(userDelete, [userIdResult[0][0].id])
            sess_obj.destroy();
            res.redirect(`/`);
        }
    } catch (error) {
        console.error('Error:', error);
        res.redirect(`/profile/${profileName}`);
    } finally {
        await connection.end();
    }
});


app.listen(port, () => {
    console.log(`Running on localhost:${port}`);
})