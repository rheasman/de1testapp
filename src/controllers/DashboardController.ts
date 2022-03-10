import { Dashboard } from "../views/Dashboard";

export interface DrawerContentType {
  name : string,
  item : JSX.Element
  visible : boolean;
}

export interface DrawerType {
  name : string,
  draweritem : JSX.Element,
  contents : DrawerContentType[]
}

export class DashboardController {

  // A drawercontent is [{ name, item }]
  // A drawer is { name: string, draweritem : string, contents: array of drawercontents}

  drawers : DrawerType[] = [];
  changecount : number = 0;
  uichild : Dashboard|undefined;
  state = {
    changecount: 0,
    currentdrawer: "Status" // The current drawer that is selected
  }

  constructor() {
    console.log("DashboardController constructor()")
  }

  getCurrentDrawer() : string {
    return this.state.currentdrawer;
  }

  setUIElement(child: Dashboard) {
    console.log("setUIElement: ", this)
    this.uichild = child;
    this.signalChange()
  }

  findDrawer(name: string): DrawerType | undefined {
    var d = this.drawers.find((val: DrawerType): boolean => { return val.name === name })
    return d;
  }

  findInDrawer(drawername: string, name: string): DrawerContentType|undefined {
    var drawer: DrawerType|undefined = this.findDrawer(drawername);

    if (drawer === undefined) return undefined;

    return drawer.contents.find((val: DrawerContentType) => { return val.name === name })
  }

  addDrawer(name : string, draweritem : JSX.Element, children?:DrawerContentType[]) {
    var drawer: DrawerType | undefined = this.findDrawer(name)
    if (drawer !== undefined) throw Error("Drawer " + name + " already exists");
    var newitem : DrawerType;
    if (children !== undefined) {
      newitem = {name, draweritem, contents : children};
    } else {
      newitem = {name, draweritem, contents : []};
    }
    this.drawers.push(newitem);  
    this.signalChange();
    console.log("After addDrawer:", this)
  }

  private signalChange() {
    this.changecount = this.changecount+1;
    if (this.uichild) {
      this.uichild.setState({changecount : this.changecount});
    }
  }

  /**
   * Add an item to an existing drawer
   * @param {string} name 
   * @param {string} drawer 
   * @param {React.Component} item 
   */
  addItem(name: string, drawername: string, item: JSX.Element, visible : boolean) {
    var drawer: DrawerType|undefined = this.findDrawer(drawername);
    if (drawer !== undefined) {
      drawer.contents.push({name, item, visible});
      this.signalChange();
    } else {
      throw Error("Couldn't find drawer "+drawername);
    }
  }

  setItemVisible(name : string, drawername: string, visible: boolean) {
    var drawer: DrawerType|undefined = this.findDrawer(drawername);

    if (drawer === undefined) return;

    drawer.contents.forEach(element => {
      if (element.name == name) {
        if (element.visible !== visible) {
          element.visible = visible;
          this.signalChange();
        }
      }
    });
  }

  setActiveDrawer(name: string) {
    console.log("setActiveDrawer(", name, ")")
    console.log("After setActiveDrawer: ", this)
    this.state.currentdrawer = name;
    this.signalChange();
  }

  removeItem(name : string, drawername: string) {
    var drawer: DrawerType|undefined = this.findDrawer(drawername);
    if (drawer !== undefined) {
      drawer.contents = drawer.contents.filter( (val, ind, arr) => { return val.name !== name } );
      this.signalChange();
    }
  }
}