import * as React from "react";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import List from "@mui/material/List";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
// import Badge from "@mui/material/Badge";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
// import NotificationsIcon from '@mui/icons-material/Notifications';
import { secondaryListItems } from "./listItems";
import { OurAppBar, OurDrawer } from "./AppBar";

import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { DashboardController, DrawerType } from "../controllers/DashboardController";
import { Copyright } from "@mui/icons-material";

export const mdTheme = createTheme();

type DashboardState = {
  open : boolean,
  changecount : number
}

type DashboardProps = {
  controller: DashboardController;
}

function wrapInPaper(item: JSX.Element) {
  return (
    <Paper
      sx={{
        p: 2,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {item}
    </Paper>
  );
}

function wrapInGridCell(name: string, item : JSX.Element) {
  console.log("wrapInGridCell: ", name)
  return (
    <Grid item key={name} xs={12}>
      {item}
    </Grid>
  )
}

export class Dashboard extends React.Component<DashboardProps, DashboardState> {
  constructor(props : DashboardProps) {
    super(props);
    this.state = {
      open: true,
      changecount: 0
    }
  }

  toggleDrawer = () => {
    this.setState({ open: !this.state.open })
  }
  
  componentDidMount() {
    this.props.controller.setUIElement(this);
  }

  dcontent() {
    console.log("dcontent() state: ", this)
    let current = this.props.controller.getCurrentDrawer()
    let activedrawer = this.props.controller.drawers.find((val : DrawerType) => {
      console.log("Compare: ", val.name, current, val.name === current)
      return val.name === current;
    });

    if (activedrawer !== undefined) {
      return activedrawer.contents.map((val) => {
        return wrapInGridCell(val.name, wrapInPaper(val.item))
      })
    } else {
      return wrapInGridCell("Oops", wrapInPaper(<p>Oops. Nothing to show.</p>))
    }
  }

  drawerContent() {
    return (
      <React.Fragment>
        {this.dcontent()}
      </React.Fragment>
    )
  }

  onDrawerClick(name: string) {
    this.props.controller.setActiveDrawer(name);
  }

  makeListItem = (details: DrawerType) : JSX.Element => {
    console.log("MakeListItem: ", details.name)
    return (
      <ListItem button key={details.name} onClick={() => { this.onDrawerClick(details.name)} }>
        <ListItemIcon>
          {details.draweritem}
        </ListItemIcon>
        <ListItemText primary={details.name} />
      </ListItem>
    )
  }
  
  mainListItems() : JSX.Element {
    let arr = Array.from(this.props.controller.drawers);
    return <div>
      {arr.map(this.makeListItem)}
    </div>
  }

  render() { 
    // This is basically boilerplate for the side drawer.
    return (
      <ThemeProvider theme={mdTheme}>
        <Box sx={{ display: "flex" }}>
          <CssBaseline />
          <OurAppBar position="absolute" open={this.state.open}>
            <Toolbar
              sx={{
                pr: "24px", // keep right padding when drawer closed
              }}
            >
              <IconButton
                edge="start"
                color="inherit"
                aria-label="open drawer"
                onClick={this.toggleDrawer}
                sx={{
                  marginRight: "36px",
                  ...(this.state.open && { display: "none" }),
                }}
              >
                <MenuIcon />
              </IconButton>
              <Typography
                component="h1"
                variant="h6"
                color="inherit"
                noWrap
                sx={{ flexGrow: 1 }}
              >
                {this.props.controller.getCurrentDrawer()}
              </Typography>
              {/* <IconButton color="inherit">
                <Badge badgeContent={4} color="secondary">
                  <NotificationsIcon />
                </Badge>
              </IconButton> */}
            </Toolbar>
          </OurAppBar>
          <OurDrawer variant="permanent" open={this.state.open}>
            <Toolbar
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                px: [1],
              }}
            >
              <IconButton onClick={this.toggleDrawer}>
                <ChevronLeftIcon />
              </IconButton>
            </Toolbar>
            <Divider />
            <List>{this.mainListItems()}</List>
            <Divider />
            <List>{secondaryListItems}</List>
          </OurDrawer>
          <Box
            component="main"
            sx={{
              backgroundColor: (theme) =>
                theme.palette.mode === "light"
                  ? theme.palette.grey[100]
                  : theme.palette.grey[900],
              flexGrow: 1,
              height: "100vh",
              overflow: "auto",
            }}
          >
            <Toolbar />
            <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
              <Grid container spacing={3}>
                {this.drawerContent()}
              </Grid>
              <Copyright sx={{ pt: 4 }} />
            </Container>
          </Box>
        </Box>
      </ThemeProvider>
    );
  }
}
