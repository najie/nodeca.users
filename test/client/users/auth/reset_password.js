'use strict';


const assert      = require('assert');
const randomBytes = require('crypto').randomBytes;
const simplesmtp  = require('simplesmtp');


describe('Reset password', function () {
  let login        = randomBytes(10).toString('hex');
  let email        = login + '@example.com';
  let old_password = randomBytes(10).toString('hex') + 'Cde123';
  let new_password = randomBytes(10).toString('hex') + 'Abc123';
  let user;
  let smtp;


  before(async function () {
    user = new TEST.N.models.users.User({
      nick: login,
      email
    });

    await user.save();

    let authProvider = new TEST.N.models.users.AuthProvider({
      type: 'plain',
      email,
      user: user._id,
      ip: '127.0.0.1',
      last_ip: '127.0.0.1'
    });

    await authProvider.setPass(old_password);
    await authProvider.save();

    smtp = simplesmtp.createServer({ disableDNSValidation: true });

    smtp.on('startData', connection => { connection.body = ''; });
    smtp.on('data', (connection, chunk) => { connection.body += chunk; });

    await new Promise((resolve, reject) => {
      smtp.listen(2525, err => (err ? reject(err) : resolve()));
    });
  });


  it('should send email with password reset link', async function () {
    let get_email = new Promise(resolve => {
      smtp.once('dataReady', (connection, cb) => {
        cb();
        resolve(connection.body.replace(/\=\r\n/g, ''));
      });
    });

    await TEST.browser
      // Request password
      .do.auth()
      .do.open(TEST.N.router.linkTo('users.auth.reset_password.request_show'))
      .do.fill('form[data-on-submit="users.auth.reset_password.request_exec"]', {
        email
      })
      .do.click('form[data-on-submit="users.auth.reset_password.request_exec"] button[type="submit"]')
      .close()
      .run();

    let email_body = await get_email;
    let route = TEST.N.router.match(/http:\/\/localhost:3005\/[^\s]+/.exec(email_body)[0]);

    assert.equal(route.meta.methods.get, 'users.auth.reset_password.change_show');

    let token = await TEST.N.models.users.TokenResetPassword.findOne({
      secret_key: route.params.secret_key
    });

    assert.equal(String(token.user), String(user._id));
  });


  it('should send email after password reset', async function () {
    let token = await TEST.N.models.users.TokenResetPassword.create({
      user: user._id,
      ip:   '127.0.0.1'
    });

    let get_email = new Promise(resolve => {
      smtp.once('dataReady', (connection, cb) => {
        cb();
        resolve(connection.body.replace(/\=\r\n/g, ''));
      });
    });

    await TEST.browser
      // Change password
      .do.open(() => TEST.N.router.linkTo('users.auth.reset_password.change_show', {
        secret_key: token.secret_key
      }))
      .do.fill('form[data-on-submit="users.auth.reset_password.change_exec"]', {
        password: new_password
      })
      .do.click('form[data-on-submit="users.auth.reset_password.change_exec"] button[type="submit"]')
      .close()
      .run();

    let email_body = await get_email;

    assert(email_body.indexOf(login) !== -1);

    let authProvider = await TEST.N.models.users.AuthProvider.findOne({
      email,
      type: 'plain',
      exists: true
    });

    assert.strictEqual(await authProvider.checkPass(new_password), true);
  });


  after(done => smtp.end(done));
});
