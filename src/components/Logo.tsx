import logo from "@/assets/logo.png";

export const Logo = () => {
  return (
    <div className="flex items-center">
      <img src={logo} alt="Logo" className="h-8 w-auto" />
    </div>
  );
};
