import { Button, ButtonGroup } from "@mui/material";
import React from "react";

function buildFileSelector(){
  const fileSelector = document.createElement('input');
  fileSelector.setAttribute('type', 'file');
  //fileSelector.setAttribute('multiple', 'multiple');
  return fileSelector;
}

export type SelectionCallback = {
  (filename : FileList | null) : void
}

interface MyProps {
  onchange : SelectionCallback
}
 
interface MyState {
  files    : FileList | null
  onchange : SelectionCallback
}


export class FileSelector extends React.Component<MyProps, MyState> {
  fileSelector : HTMLInputElement | undefined;

  constructor(props : MyProps) {
    super(props)
    this.state = {
      files    : null,
      onchange : props.onchange
    }
  }

  componentDidMount(){
    this.fileSelector = buildFileSelector();
    this.fileSelector.addEventListener("change", this.selectionChanged);  
  }
  
  handleFileSelect : React.MouseEventHandler<HTMLButtonElement> = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();
    if (this.fileSelector) {
      this.fileSelector.click();
    }
  }
  
  selectionChanged = (event : any) => {
    console.log("selectionChanged event: " + event)
    if (!event?.target?.files) return;
    
    this.state.onchange(event.target.files)
    this.setState({ files : event.target.files })
  }

  render(){
    return (
      <div>
      <Button variant="contained" onClick={this.handleFileSelect}>Select file</Button>        
      </div>
    )
  }
}
