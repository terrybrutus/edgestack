import List "mo:core/List";
import Types "../types/items";
import ItemsLib "../lib/items";

mixin (items : List.List<Types.Item>, state : { var nextId : Nat }) {
  public func createItem(title : Text) : async Nat {
    ItemsLib.createItem(items, state, title);
  };

  public query func getItems() : async [Types.Item] {
    ItemsLib.getItems(items);
  };

  public func updateItem(id : Nat, title : Text, status : Types.ItemStatus) : async Bool {
    ItemsLib.updateItem(items, id, title, status);
  };

  public func deleteItem(id : Nat) : async Bool {
    ItemsLib.deleteItem(items, id);
  };
};
