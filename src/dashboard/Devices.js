import * as React from 'react';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Title from './Title';

// Generate Machine Data
function createData(addr, name) {
  return { addr, name };
}

const rows = [
  createData(
    "00 12 34 56 AB CD",
    "DE1"
  ),
];

function preventDefault(event) {
  event.preventDefault();
}

export default function Devices() {
  return (
    <React.Fragment>
      <Title>Seen Devices</Title>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>BLE Address</TableCell>
            <TableCell>BLE Name</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.addr}>
              <TableCell>{row.addr}</TableCell>
              <TableCell>{row.name}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Link color="primary" href="#" onClick={preventDefault} sx={{ mt: 3 }}>
        See more orders
      </Link>
    </React.Fragment>
  );
}
