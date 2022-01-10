/**
 * This class is intended to help with a proper Model - View - Controller implementation, with a small twist.
 * 
 * Rather than the Controller driving both the View and the Model, the Controller only drives the Model, and the
 * Model drives the View via callbacks.
 * 
 * The View will notified when something it has registered to monitor, changes in the keystore, so it can update.
 * 
 * This way there is one central store of all data, and views are completely decoupled. Also, we don't encode data
 * relationships, parentage, etc in the structure of the code building the views, and the relationships between
 * controllers is no longer constrained by UI or OOP concerns.
 */

export enum E_Status {
  Added,
  Changed,
  Deleted
}
export type NotifyCallbackType = (owner: string, key: string, status: E_Status, before: any, after: any) => void;

type StoreItemType = Map<string, any>
type OwnerDictType = Map<string, StoreItemType>
type NotifyItemType = Map<string, Set<NotifyCallbackType>>;
type NotifyOwnerDictType = Map<string, NotifyItemType>

/**
 * KeyStore is intended to be used as a singleton!
 * Grab your instance from KeyStore.instance
 */
class KeyStore  {
  // @ts-expect-error
  static instance : KeyStore = KeyStore.instance || new KeyStore();

  // Syntactic sugar if you prefer it
  getInstance() {
    return KeyStore.instance;
  }

  // We store key value pairs here
  globalkeystore : OwnerDictType = new Map<string, StoreItemType>() // dict of dicts. Outer key is owner, inner is key

  // We store sets of notify functions for each key, here.
  notifybykey : NotifyOwnerDictType = new Map<string, NotifyItemType>()  // dict[owner] of dict[key] of sets of callback functions

  // Return the dict owned by ownername. Creates it if necessary.
  _getStore(ownername: string): StoreItemType {
    var store = this.globalkeystore.get(ownername);
    if (!store) {
      store = new Map<string, any>();
      this.globalkeystore.set(ownername, store)
    }
    return store;
  }

  // Notify any listeners of a key having been added
  _doNotifyAdded(owner: string, key: string, newvalue: any) {
    const keystore = this.notifybykey.get(owner);
    if (keystore !== undefined) {
      const fnset = keystore.get(key);
      if (fnset) {
        fnset.forEach((value) => {
          value(owner, key, E_Status.Added, null, newvalue);
        });
      }  
    }
  }

  // Notifies any registered callbacks that a key has been deleted.
  // Also deletes the callback function pointers for the key after calling them.
  _doNotifyDeleted(owner: string, key: string, oldvalue: any) {
    var keystore = this.notifybykey.get(owner);
    if (keystore !== undefined) {
      var fnset = keystore.get(key);
      if (fnset) {
        fnset.forEach((value) => {
          value(owner, key, E_Status.Deleted, oldvalue, null);
        });
        keystore.delete(key);
      }  
    }
  }

  _doNotifyChanged(owner: string, key: string, oldvalue: any, newvalue: any) {
    const keystore = this.notifybykey.get(owner);
    if (keystore !== undefined) {
      const fnset = keystore.get(key);
      if (fnset) {
        fnset.forEach((value) => {
          value(owner, key, E_Status.Changed, oldvalue, newvalue);
        });
      }  
    }
  }

  /**
   * updateKey
   * 
   * @param {string} ownername 
   * @param {string} key 
   * @param {*} newvalue 
   * @param {bool} forcenotify 
   * 
   * If there are any notify callbacks associated with a key, and the value changes,
   * the callbacks will be called. This does not do deep comparison of objects,
   * so use 'forcenotify' if necessary.
   * 
   * NB: SHOULD ONLY BE USED BY THE OWNER. The keystore is not supposed to be
   * a big global variable. Owners change things, and everyone else watches.
   */
  updateKey(ownername: string, key: string, newvalue: any, forcenotify?: boolean) {
    console.log("updateKey:", ownername, key, newvalue, forcenotify);
    var store = this._getStore(ownername);
    const oldvalue = store.get(key);
    if ((forcenotify) || (oldvalue !== newvalue)) {
      store.set(key, newvalue);
      this._doNotifyChanged(ownername, key, oldvalue, newvalue);
    }
  }

  // Read key
  readKey(ownername: string, key: string) {
    const store = this._getStore(ownername)
    return store.get(key);
  }

  // Delete key
  // Also deletes any notification requests associated with the key, after
  // calling them.
  delKey(ownername: string, key: string) {
    var store = this._getStore(ownername);
    if ( store.has(key) ) {
      let oldvalue = store.get(key);
      this._doNotifyDeleted(ownername, key, oldvalue);  
      store.delete(key);
    }

  }

  // Delete all keys owned by owner (and their callbacks)
  // Should be used by an owner to clean up after itself
  delOwnerKeys(ownername: string) {
    var store = this._getStore(ownername)
    for(let key of Array.from(store.keys()) ) {
      this.delKey(ownername, key)
    }
  }

  /**
   * requestNotifyOnChanged
   *  
   * @param {string} ownername 
   * @param {string} key 
   * @param {function} changedfn 
   * 
   * Add a notify callback function that will be called when a key is added, deleted, or modified.
   * You can register for the callback before the key exists.
   * 
   * Prototype for changedfn:
   *  fn(owner, key, status, before, after)
   * 
   *  owner: string identifying owner
   *  key: string identifying key
   *  status: will be one of 'Added', 'Changed', 'Deleted'
   *  before: null or the old value before a change
   *  after: null or the value after a change
   * 
   * Note that callbacks are made the instant updateStore/delKey are called,
   * so if you only want to react after a complete operation is done,
   * perhaps only notify on a key that can be set after all changes have been made.
   */
  requestNotifyOnChanged(ownername: string, key: string, changedfn: NotifyCallbackType) {
    console.log("requestNotifyOnChanged:", ownername, key)
    if (!ownername) throw Error("Ownername invalid");
    if (!key) throw Error("Key invalid");

    var keystore = this.notifybykey.get(ownername);
    if (!keystore) {
      keystore = new Map<string, Set<NotifyCallbackType>>();
      this.notifybykey.set(ownername, keystore);
    }
    let notifyset = keystore.get(key)
    if (!notifyset) {
      notifyset = new Set([])
      keystore.set(key, notifyset)
    }
    notifyset.add(changedfn)
  }

  // Cancel the given notify for the given key
  cancelNotify(ownername: string, key: string, fn: NotifyCallbackType) {
    var keystore = this.notifybykey.get(ownername);
    if (keystore !== undefined) {
      var fnset = keystore.get(key);
      if (fnset) fnset.delete(fn);  
    }
  }
}
 
export default KeyStore;