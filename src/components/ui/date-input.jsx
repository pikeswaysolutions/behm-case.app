import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const DateInput = React.forwardRef(
  ({ value, onChange, className, placeholder = "MM/DD/YYYY", ...props }, ref) => {
    const [open, setOpen] = React.useState(false);
    const [inputValue, setInputValue] = React.useState(
      value ? format(value, "MM/dd/yyyy") : ""
    );

    React.useEffect(() => {
      if (value) {
        setInputValue(format(value, "MM/dd/yyyy"));
      }
    }, [value]);

    const handleInputChange = (e) => {
      const newValue = e.target.value;
      setInputValue(newValue);

      if (newValue.length >= 8) {
        const formats = ["MM/dd/yyyy", "M/d/yyyy", "MM-dd-yyyy", "M-d-yyyy", "M/d/yy", "MM/dd/yy"];
        for (const formatString of formats) {
          try {
            const parsed = parse(newValue, formatString, new Date());
            if (isValid(parsed) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
              onChange?.(parsed);
              return;
            }
          } catch (err) {
          }
        }
      }
    };

    const handleInputBlur = () => {
      if (value) {
        setInputValue(format(value, "MM/dd/yyyy"));
      }
    };

    const handleCalendarSelect = (date) => {
      if (date) {
        onChange?.(date);
        setInputValue(format(date, "MM/dd/yyyy"));
        setOpen(false);
      }
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <div className={cn("relative", className)}>
          <Input
            ref={ref}
            type="text"
            placeholder={placeholder}
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            className="pr-10"
            {...props}
          />
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            >
              <CalendarIcon className="h-4 w-4 text-slate-500" />
            </Button>
          </PopoverTrigger>
        </div>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={handleCalendarSelect}
            initialFocus
            captionLayout="dropdown-buttons"
            fromYear={2000}
            toYear={new Date().getFullYear() + 5}
          />
        </PopoverContent>
      </Popover>
    );
  }
);

DateInput.displayName = "DateInput";

export { DateInput };
