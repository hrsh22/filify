import { useState, type MouseEvent, type SyntheticEvent } from "react";
import { LogOut } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/context/toast-context";
import { useNavigate } from "react-router-dom";

interface SignOutButtonProps extends ButtonProps {
    label?: string;
    onSelect?: (event: SyntheticEvent<HTMLButtonElement>) => void;
}

export function SignOutButton({ label = "Sign out", onSelect, onClick, disabled, ...props }: SignOutButtonProps) {
    const { logout } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const runLogout = async (event?: SyntheticEvent<HTMLButtonElement>) => {
        event?.preventDefault?.();
        if (disabled || isSubmitting) return;
        try {
            setIsSubmitting(true);
            await logout();
            showToast("Signed out", "success");
            navigate("/");
        } catch (error) {
            console.error("[SignOutButton]", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        await runLogout(event);
    };

    const handleSelect = async (event: SyntheticEvent<HTMLButtonElement>) => {
        onSelect?.(event);
        if (event.defaultPrevented) return;
        await runLogout(event);
    };

    const isDisabled = disabled || isSubmitting;

    return (
        <Button onClick={handleClick} onSelect={handleSelect} disabled={isDisabled} variant="ghost" {...props}>
            <LogOut className="h-4 w-4" />
            {isSubmitting ? "Signing out..." : label}
        </Button>
    );
}
