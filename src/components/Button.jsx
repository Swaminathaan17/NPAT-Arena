export default function Button({ children, variant = 'primary', className = '', ...props }) {
  return <button className={`button ${variant} ${className}`} {...props}>{children}</button>;
}