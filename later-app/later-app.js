Tasks = new Mongo.Collection("tasks");
Friends = new Mongo.Collection("friends");
Notifications = new Mongo.Collection("notifications");

var NEW_FRIEND_NOTIFICATION = "new_friend";

if (Meteor.isServer) {
  // This code only runs on the server
  // Only publish tasks that are public or belong to the current user
  Meteor.publish("tasks", function () {
    return Tasks.find(
        { $or: [ {creator: this.userId }, {receiver: this.userId} ] }
    );
  });
  Meteor.publish("friends", function() {
    return Friends.find(
      { $or : [ {user_id: this.userId}, {friend_id: this.userId}]}
    );
  });
  Meteor.publish("notifications", function() {
    return Notifications.find(
      { user_id: this.userId, friend_id : { $ne : this.userId }}
    );
  });

  function getUsernameForID(ID) {
    var user =  Meteor.users.findOne({
      _id: ID
    });

    return user? user.username : undefined;
  }

  function getIDForUsername(uname) {
    var user =  Meteor.users.findOne({
      username: uname
    });
    if (!user) {
      var uid = undefined;
      var f = Friends.findOne({'friend_name': uname});
      if (f) {
        uid = f.friend_id
      } else {
        f = Friends.findOne({'user_name': uname});
        if(f) uid = f.user_id;
      }
    }
    return user? user._id : uid;
  }

  function get_approved_friends() {
    var approved = Friends.find({approved: true})
        .map(function(f) { return f.user_id });
    approved.push(Meteor.userId());
    return approved;
  }
}

if (Meteor.isClient) {
  // This code only runs on the client
  Meteor.subscribe("tasks");
  Meteor.subscribe("friends");
  Meteor.subscribe("notifications");

  function friends() {
      var case1 = Friends.find().map(function(f) {return [f.friend_name, f.user_name]});
      return $.unique([].concat.apply([], case1));
  }

  Template.body.helpers({
    notifications: function () {
      return Notifications.find();
    },
    hideCompleted: function () {
      return Session.get("hideCompleted");
    },
    articleFilter: function () {
      return Session.get("articleFilter");
    },
    videoFilter: function () {
      return Session.get("videoFilter");
    },
    musicFilter: function () {
      return Session.get("musicFilter");
    },
    otherFilter: function () {
      return Session.get("otherFilter");
    },
    inboxFilter: function () {
      return Session.get("inboxFilter");
    },
    incompleteCount: function () {
      return Tasks.find({checked: {$ne: true}}).count();
    },
    friends: function() {
      return friends();
    },
    blockedFriends: function() {
      return Friends.find({approved: false, friend_id: Meteor.userId()});
    }
  });

  Template.taskList.lastUpdate = function () {
    return Session.get('lastUpdateTasks');
  };

  Template.taskList.helpers({
    tasks: function () {
      var filters = [];

      {
        //TYPE FILTER
        var type_filter = [];
        if (Session.get("articleFilter"))
          type_filter.push({type: {$in: ["article"]}});

        if (Session.get("videoFilter"))
          type_filter.push({type: {$in: ["video"]}});

        if (Session.get("musicFilter"))
          type_filter.push({type: {$in: ["music"]}});

        if (Session.get("otherFilter"))
          type_filter.push({type: {$in: ["other"]}});

        if(type_filter.length > 0)
          filters.push({$or: type_filter});
      }

      {
        // INBOX/OUTBOX FILTER
        var session_filter = [];
        if (Session.get("inboxFilter"))
          session_filter.push({receiver: {$in: [Meteor.userId()]}});
        else
          session_filter.push({receiver: {$ne: Meteor.userId()}});

        if (session_filter.length > 0)
          filters.push({$or: session_filter})
      }

      // NAME FILTER
      {
        var name_filter = [];
        var friendlist = friends();
        var selectedFriends = [];
        for (var x in friendlist) {
          var sessionVar = friendlist[x] + "_filter";
          if (Session.get(sessionVar)) {
            selectedFriends.push(getIDForUsername(friendlist[x]));
          }
        }
        filters.push({$or: [{creator: {$in: selectedFriends}}, {receiver: {$in: selectedFriends}}]});
      }

      // SEARCH FILTER
      {
        var search_term = $('.search-bar').val();

        // HACKY - changing this causes it to rerender
        // we change this on keyup in searchbar
        Session.get("forceUpdateTasks");

        if(search_term) {
          filters.push({"title" : {$regex : ".*"+search_term+".*"}});
        }
      }

      // COMPLETED FILTER
      if (Session.get("hideCompleted"))
        filters.push({checked: {$ne: true}});

      // APPROVED FRIENDS
      filters.push({creator: {$in: get_approved_friends()}});

      return Tasks.find({$and: filters}, {sort: {createdAt: -1}});
    }
  })

  Template.addItemForm.onRendered(function() {
    Meteor.typeahead.inject();
    $('.dropdown-toggle').dropdown()
  }),

  // TODO : move a bunch of this to the form template
  Template.body.events({
    "submit .new-item-form": function (event) {
      // Prevent default browser form submit
      event.preventDefault();
      $('.new-item-form .error').empty();

      // Get value from form element
      var receiver = event.target.item_receiver.value;
      var link = event.target.item_link.value;
      if (link.indexOf('http') !== 0) {
        link = "http://" + link;
      }

      var item = {receiver: receiver,
                  link: link,
                 };

      // Insert a task into the collection
      Meteor.call("addTask", item, function(error, result) {
        if (error) {
          $('.new-item-form .error').html("Error: " + error.reason);
          return;
        } else {
          // Clear form
          event.target.reset();
          $('.new-item-trigger').trigger('click');
        }
      });

    },
    "keyup .search-bar": function (event) {
      Session.set("forceUpdateTasks", new Date());
    }
  });

  Template.filters.helpers({
    friends: function() {
      return friends();
    }
  });

  Template.filters.rendered = function() {
    if(!this._rendered) {
      this._rendered = true;
      $(".hide-completed input")[0].click();
      $(".article-filter input")[0].click();
      $(".video-filter input")[0].click();
      $(".music-filter input")[0].click();
      $(".other-filter input")[0].click();
      $(".inbox-filter input")[0].click();
    }
  }

  Template.nameFilter.helpers({
    getName: function() {
      return this;
    },
    isChecked: function() {
      var sessionVar = this + "_filter";
      return Session.get(sessionVar);
    }
  });

  Template.nameFilter.rendered = function() {
    if(!this._rendered) {
      this._rendered = true;
      $(".name-filter[data-uname='" + this.data + "']").trigger('click');
    }
  }

  Template.nameFilter.events({
    "click .name-filter": function (event) {
      var sessionVar = $(event.target).data('uname') + "_filter";
      $(event.target).data('checked',!$(event.target).data('checked'));
      Session.set(sessionVar, $(event.target).data('checked'));
    }
  })

  Template.filters.events({
    "change .hide-completed input": function (event) {
      Session.set("hideCompleted", event.target.checked);
    },
     "change .article-filter input": function (event) {
      Session.set("articleFilter", event.target.checked);
    },
     "change .video-filter input": function (event) {
      Session.set("videoFilter", event.target.checked);
    },
     "change .music-filter input": function (event) {
      Session.set("musicFilter", event.target.checked);
    },
     "change .other-filter input": function (event) {
      Session.set("otherFilter", event.target.checked);
    },
    "change .inbox-filter input": function (event) {
      Session.set("inboxFilter", event.target.checked);
    }
  });

  function getFriendNameFromId(friend_id) {
    var f = Friends.findOne({'user_id' : friend_id});
    return f.user_name;
  };

  Template.manageFriendship.helpers({
    'getFriendName': function() {
      return getFriendNameFromId(this.friend_id);
    }
  });

  Template.manageBlocked.helpers({
    'getFriendName': function() {
      return getFriendNameFromId(this.user_id);
    }
  });

  Template.manageBlocked.events({
    "click .approve": function () {
      // Set the checked property to the opposite of its current value
      // This is acting on the Friends collection, so the current user is
      // actually the this.friend_id in the Friends collection
      Meteor.call("setApproved", this.friend_id, this.user_id, true);
    },
  });

  Template.manageFriendship.events({
    // These are acting on the Notifications collection, so we are approving
    // the current user is this.user_id
    "click .approve": function () {
      // Set the checked property to the opposite of its current value
      Meteor.call("setApproved", this.user_id, this.friend_id, true);
    },
    "click .block": function () {
      Meteor.call("setApproved", this.user_id, this.friend_id, false);
    }
  });

  Template.task.helpers({
    'getCreator': function () {
      var f = Friends.findOne({'user_id' : this.creator});
      return f ? f.user_name : '';

    },
    'getReceiver': function () {
      var f = Friends.findOne({'friend_id' : this.receiver});
      return f ? f.friend_name : '';

    },
    'getTypeFontAwesome': function () {
      switch(this.type) {
        case 'article':
          return 'fa-file-text-o';
        case 'video':
          return 'fa-video-camera';
        case 'music':
          return 'fa-headphones';
        case 'other':
          return 'fa-external-link';
      }
    },
    'creatorIsReceiver': function () {
      return this.creator === Meteor.userId();
    },
    'isIncoming': function() {
      return this.receiver == Meteor.userId();
    },
    'tags': function() {
      return this.tags;
    }
  });

  Template.task.events({
    "click .toggle-checked": function () {
      // Set the checked property to the opposite of its current value
      Meteor.call("setChecked", this._id, ! this.checked);
    },
    "click .delete": function () {
      Meteor.call("deleteTask", this._id);
    },
    "keyup .new-tag input": function (e) {
      if(e.keyCode == 13) {
        var newTag = e.target.value;
        if($.inArray(newTag, this.tags) == -1) {
          Meteor.call("addTag", this._id, newTag);
        }
        e.target.value = "";
      }
    }
  });

  Template.tag.helpers({
    'getName': function () {
      return this;
    }
  })

  Accounts.ui.config({
    passwordSignupFields: "USERNAME_ONLY"
    // passwordSignupFields: "USERNAME_AND_EMAIL"
  });

// End of Client only code
}


Meteor.methods({
  addTask: function (item) {
    // Make sure the user is logged in before inserting a task
    if (! Meteor.userId()) {
      throw new Meteor.Error("not-authorized");
    }

    var receiverID = getIDForUsername(item.receiver);

    if (! receiverID && this.isSimulation) {
      return;
    } else if (! receiverID) {
      throw new Meteor.Error("no-user", "User " + item.receiver + " does not exist");
    }

    meta = extractMeta(item.link);

    Tasks.insert({
      receiver: receiverID,
      title: meta.title,
      link: item.link,
      type: meta.type,
      createdAt: new Date(),
      creator: Meteor.userId()
    });

    if (!Friends.findOne({user_name: Meteor.user().username, friend_name: item.receiver})) {
      Friends.insert({
        user_name: Meteor.user().username,
        user_id: Meteor.userId(),
        friend_name: item.receiver,
        friend_id: receiverID
      });
      Notifications.insert({
        user_id: receiverID,
        friend_id: Meteor.userId(),
        type: NEW_FRIEND_NOTIFICATION
      });
    }

  },
  deleteTask: function (taskId) {
    var task = Tasks.findOne(taskId);
    if (task.creator !== Meteor.userId() && task.receiver !== Meteor.userId()) {
      // make sure only the creator can delete it
      throw new Meteor.Error("not-authorized");
    }

    Tasks.remove(taskId);
  },
  setChecked: function (taskId, setChecked) {
    var task = Tasks.findOne(taskId);
    if (task.receiver !== Meteor.userId()) {
      // make sure only the creator can check it off
      throw new Meteor.Error("not-authorized");
    }

    Tasks.update(taskId, { $set: { checked: setChecked} });
  },
  setApproved: function (currentUser, friendId, setApproved) {
    var friendship = Friends.update({user_id : friendId, friend_id : currentUser},
      {$set: { approved: setApproved }});
    var notification = Notifications.remove({user_id : currentUser, friend_id: friendId});
  },
  getUsername: function (id) {
    return getUsernameForID(id);
  },
  addTag: function(id, newTag) {
    tags = Tasks.findOne({_id: id}).tags;

    tags = tags? tags : [];

    tags.push(newTag);

    Tasks.update(id, {$set: {'tags' : tags}});
  }
});
