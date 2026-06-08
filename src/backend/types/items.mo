module {
  public type ItemStatus = { #todo; #done };

  public type Item = {
    id : Nat;
    title : Text;
    status : ItemStatus;
  };
};
