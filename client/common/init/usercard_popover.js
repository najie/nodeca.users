'use strict';


//
// Cache user profiles for 5 minutes
//

var CACHE     = {};
var CACHE_TTL = 5 * 60 * 1000; // time in ms

//
// Time in milliseconds before showing a popover
//

var POPOVER_INTENT = 500;


//
// Cross-browser Date.now()
//

function now() {
  return (new Date()).getTime();
}


//
// Returns user info card from cache.
// Request from server if it's not yet cahed or cache outdated.
//

function getUserInfo(id, callback) {
  if (CACHE[id] && CACHE_TTL > (CACHE[id].ts - now())) {
    callback(CACHE[id]);
    return;
  }

  nodeca.io.apiTree('users.usercard_popover', { id: id }, function (err, resp) {
    callback(CACHE[id] = {
      ts:   now(),
      user: (err ? null : (resp.data || {}).user)
    });
  });
}


////////////////////////////////////////////////////////////////////////////////


$.fn.powerTip.smartPlacementLists.usercard = [ 'ne-nodeca', 'se-nodeca', 'nw-nodeca', 'sw-nodeca' ];


////////////////////////////////////////////////////////////////////////////////


module.exports = function active_profiles() {
  $('body').on('mouseenter.nodeca.data-api', 'a.usercard-popover', function (event) {
    var $this = $(this),
        id    = $this.data('user-id'),
        card  = $this.data('usercard');

    if (!id) {
      return;
    }

    getUserInfo(id, function (data) {
      if (!data.user) {
        // no user -- do not do anything
        return;
      }

      if (card !== data.ts) {
        $this.data('usercard', data.ts);
        $this.data('powertip', nodeca.client.common.render('common.widgets.usercard_popover', data.user));
      }

      if (!card) {
        $this.powerTip({
          placement:          'usercard',
          smartPlacement:     true,
          mouseOnToPopup:     true,
          intentPollInterval: POPOVER_INTENT
        });

        setTimeout(function () {
          $.powerTip.showTip($this);
        }, POPOVER_INTENT);
      }
    });
  });
};