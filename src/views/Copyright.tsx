import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";


function Copyright<Props extends {}>(props: Props) {
  return (
    <Typography
      variant="body2"
      color="text.secondary"
      align="center"
      {...props}
    >
      {"Copyright © "}
      <Link color="inherit" href="https://decentespresso.com/">
        Decent Espresso
      </Link>{" "}
      {new Date().getFullYear()}
      {"."}
    </Typography>
  );
}
