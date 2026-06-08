import List "mo:core/List";
import Types "../types/items";

module {
  public type Item = Types.Item;
  public type ItemStatus = Types.ItemStatus;

  public func createItem(
    items : List.List<Item>,
    state : { var nextId : Nat },
    title : Text,
  ) : Nat {
    let id = state.nextId;
    state.nextId += 1;
    items.add({ id; title; status = #todo });
    id;
  };

  public func getItems(items : List.List<Item>) : [Item] {
    items.toArray();
  };

  public func updateItem(
    items : List.List<Item>,
    id : Nat,
    title : Text,
    status : ItemStatus,
  ) : Bool {
    var found = false;
    items.mapInPlace(
      func(item) {
        if (item.id == id) {
          found := true;
          { item with title; status };
        } else { item };
      }
    );
    found;
  };

  public func deleteItem(items : List.List<Item>, id : Nat) : Bool {
    let sizeBefore = items.size();
    let filtered = items.filter(func(item) { item.id != id });
    items.clear();
    items.addAll(filtered.values());
    items.size() != sizeBefore;
  };
};
