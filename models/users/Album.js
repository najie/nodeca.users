// User albums

'use strict';


var Mongoose = require('mongoose');
var Schema   = Mongoose.Schema;
var async    = require('async');


module.exports = function (N, collectionName) {

  var Album = new Schema({
    'title'         : String,
    'user_id'       : Schema.Types.ObjectId,
    'last_ts'       : { 'type': Date, 'default': Date.now },

    // Source file '_id'. Use thumbnail to show cover.
    'cover_id'      : Schema.Types.ObjectId,
    'count'         : { 'type': Number, 'default': 0 },

    // true if almum is default, for incoming medias.
    // Such albums can not be deleted
    'default'       : { 'type': Boolean, 'default': false }
  },
  {
    versionKey: false
  });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // User albums page, fetch albums list
  //
  // Sorting done in memory, because albums count per user is small, and we
  // always fetch full list.
  //
  // Note, album last ts & menia count are updated on each photo upload. It's
  // good to avoid index change.
  //
  Album.index({ user_id   : 1 });


  //////////////////////////////////////////////////////////////////////////////


  // Update media count in album
  //
  var updateCount = function (albumId, full, callback) {
    var Album = N.models.users.Album;
    var Media = N.models.users.Media;

    if (!full) {
      Album.update({ _id: albumId }, { $inc: { count: 1 } }, callback);
      return;
    }

    Media.count({ album_id: albumId, exists: true }, function (err, result) {
      if (err) {
        callback(err);
        return;
      }

      Album.update({ _id: albumId }, { count: result }, callback);
    });
  };


  // Update album cover
  //
  var updateCover = function (albumId, callback) {
    var Album = N.models.users.Album;
    var Media = N.models.users.Media;

    // Fetch album
    Album.findOne({ _id: albumId }).lean(true).exec(function (err, album) {
      if (err) {
        callback(err);
        return;
      }

      // Check cover exists
      Media.count({ file_id: album.cover_id, exists: true }, function (err, count) {
        if (err) {
          callback(err);
          return;
        }

        // Do nothing if cover exists
        if (count !== 0) {
          callback();
          return;
        }

        // Update cover
        Media.findOne({ album_id: album._id, exists: true, type: 'image' })
          .sort('-ts').lean(true).exec(function (err, result) {
            if (err) {
              callback(err);
              return;
            }

            Album.update({ _id: albumId }, { cover_id: result ? result.file_id : null }, callback);
          });
      });

    });
  };


  // Update album info (count, last_ts, cover)
  //
  // - albumId - album _id
  // - full - Boolean. true - recalculate count, false - just increment count. Default false
  //
  Album.statics.updateInfo = function (albumId, full, callback) {
    if (!callback) {
      callback = full;
      full = false;
    }

    async.parallel([
      function (next) {
        updateCount(albumId, full, next);
      },
      function (next) {
        updateCover(albumId, next);
      },
      function (next) {
        N.models.users.Album.update({ _id: albumId }, { last_ts: Date.now() }, next);
      }
    ], function (err) {
      if (err) {
        callback(err);
        return;
      }

      callback();
    });
  };


  N.wire.on('init:models', function emit_init_Album(__, callback) {
    N.wire.emit('init:models.' + collectionName, Album, callback);
  });

  N.wire.on('init:models.' + collectionName, function init_model_Album(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
