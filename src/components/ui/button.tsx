import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-olive-700 text-cream-100 shadow-soft hover:bg-olive-900 focus-visible:outline-olive-900",
  secondary:
    "border border-olive-700/25 bg-cream-100 text-olive-900 hover:border-olive-700/50 hover:bg-white focus-visible:outline-olive-900",
  ghost: "text-olive-900 hover:bg-olive-700/10 focus-visible:outline-olive-900"
};

type BaseProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
};

type AnchorButtonProps = BaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  };

type NativeButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: never;
  };

function isAnchorButtonProps(
  props: AnchorButtonProps | NativeButtonProps
): props is AnchorButtonProps {
  return typeof (props as { href?: unknown }).href === "string";
}

export function Button(props: AnchorButtonProps | NativeButtonProps) {
  const { children, variant = "primary", className = "" } = props;
  const classes = `inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${variantClasses[variant]} ${className}`;

  if (isAnchorButtonProps(props)) {
    const { children: _children, variant: _variant, className: _className, ...anchorProps } = props;
    return (
      <a className={classes} {...anchorProps}>
        {children}
      </a>
    );
  }

  const { children: _children, variant: _variant, className: _className, ...buttonProps } = props;
  return (
    <button className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
