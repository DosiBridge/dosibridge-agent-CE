from mcp.server.fastmcp import FastMCP
import math
import operator
from decimal import Decimal, getcontext
from typing import Any, Dict, Union

# Set high precision for decimal operations
getcontext().prec = 100

# Initialize MCP server
mcp = FastMCP(name="math", stateless_http=True)

def _ok(result: Any):
    """Standard success response"""
    return {"ok": True, "data": {"result": result}, "error": None, "meta": {}}

def _err(message: str, code: str = "MATH_ERROR"):
    """Standard error response"""
    return {"ok": False, "data": None, "error": {"message": message, "code": code}, "meta": {}}

def _safe_convert_number(value: Union[str, int, float]) -> Union[int, float, Decimal]:
    """Convert any numeric string/value to appropriate numeric type"""
    if isinstance(value, (int, float, Decimal)):
        return value
    try:
        # Try integer first for precision
        if '.' not in str(value) and 'e' not in str(value).lower():
            return int(value)
        # Use Decimal for high precision
        dec = Decimal(str(value))
        if dec % 1 == 0:
            return int(dec)
        return float(dec)  # Keep as float for standard operations
    except (ValueError, TypeError):
        raise ValueError(f"Cannot convert '{value}' to number")

# Safe math namespace for expression evaluation
SAFE_MATH_NAMESPACE = {
    '__builtins__': {},
    'abs': abs, 'round': round, 'min': min, 'max': max, 'sum': sum,
    'int': int, 'float': float,
    'pow': pow, '**': operator.pow,
    '+': operator.add, '-': operator.sub, '*': operator.mul, '/': operator.truediv,
    '//': operator.floordiv, '%': operator.mod,
    'math': math,
    'sin': math.sin, 'cos': math.cos, 'tan': math.tan,
    'asin': math.asin, 'acos': math.acos, 'atan': math.atan, 'atan2': math.atan2,
    'sinh': math.sinh, 'cosh': math.cosh, 'tanh': math.tanh,
    'exp': math.exp, 'log': math.log, 'log10': math.log10, 'log2': math.log2,
    'sqrt': math.sqrt, 'cbrt': lambda x: x ** (1/3),
    'pi': math.pi, 'e': math.e,
    'ceil': math.ceil, 'floor': math.floor, 'trunc': math.trunc,
    'degrees': math.degrees, 'radians': math.radians,
    'factorial': math.factorial, 'gcd': math.gcd, 'lcm': lambda a, b: abs(a * b) // math.gcd(a, b) if a and b else 0,
}

def _evaluate_expression(expr: str) -> Union[int, float, complex]:
    """Safely evaluate mathematical expression"""
    try:
        # Compile and evaluate in restricted namespace
        code = compile(expr, '<string>', 'eval')
        result = eval(code, SAFE_MATH_NAMESPACE)
        
        # Handle complex numbers
        if isinstance(result, complex):
            return result
        
        # Return appropriate type
        if isinstance(result, (int, float)):
            return result
        raise ValueError(f"Expression returned non-numeric: {type(result)}")
    except ZeroDivisionError:
        raise ValueError("Division by zero")
    except SyntaxError as e:
        raise ValueError(f"Invalid expression syntax: {str(e)}")
    except Exception as e:
        raise ValueError(f"Evaluation error: {str(e)}")

@mcp.tool()
def calculate(expression: str) -> dict:
    """PRIMARY MATH TOOL: Evaluate ANY mathematical expression with multiple numbers and operations. Use this for ALL calculations including adding/subtracting/multiplying multiple numbers, complex expressions, and any math operations.
    
    Supports: multiple numbers (e.g., "2 + 3 + 4 + 5"), all standard operations, functions (sin, cos, log, sqrt, etc.), and constants (pi, e). Handles integers, floats, and large numbers.
    
    Examples:
    - "2 + 3 + 4 + 5" (adding multiple numbers)
    - "10 - 3 - 2" (subtracting multiple numbers)
    - "2 * 3 * 4" (multiplying multiple numbers)
    - "100 / 2 / 5" (dividing multiple numbers)
    - "2 + 2"
    - "sqrt(16) + pow(2, 3)"
    - "sin(pi/2) * cos(0)"
    - "factorial(5)"
    - "2**1000" (supports very large numbers)
    
    IMPORTANT: Always use this tool for any calculation, especially when dealing with more than two numbers. The other tools (add, subtract, etc.) are only for simple two-number operations.
    """
    try:
        if not expression or not expression.strip():
            return _err("Expression cannot be empty", "VALIDATION_ERROR")
        result = _evaluate_expression(expression.strip())
        return _ok(result)
    except ValueError as e:
        return _err(str(e), "MATH_ERROR")
    except Exception as e:
        return _err(f"Unexpected error: {str(e)}", "INTERNAL_ERROR")

@mcp.tool()
def add(a: Union[str, int, float], b: Union[str, int, float]) -> dict:
    """Add exactly two numbers. For adding more than two numbers or complex expressions, use the 'calculate' tool instead. Example: use calculate("2 + 3 + 4") instead of multiple add calls."""
    try:
        num_a = _safe_convert_number(a)
        num_b = _safe_convert_number(b)
        result = num_a + num_b
        return _ok(result)
    except ValueError as e:
        return _err(str(e), "VALIDATION_ERROR")
    except Exception as e:
        return _err(f"Addition error: {str(e)}", "MATH_ERROR")

@mcp.tool()
def add_multiple(numbers: str) -> dict:
    """Add multiple numbers together. Provide numbers as a comma-separated string or space-separated string.
    
    Examples:
    - "2,2,2,2,2,2,2,2" (comma-separated)
    - "2 2 2 2 2 2 2 2" (space-separated)
    - "10, 20, 30, 40" (with spaces)
    
    This is a convenience function for adding multiple numbers. For complex expressions, use 'calculate' instead.
    """
    try:
        if not numbers or not numbers.strip():
            return _err("Numbers cannot be empty", "VALIDATION_ERROR")
        
        # Try comma-separated first, then space-separated
        if ',' in numbers:
            num_strs = [n.strip() for n in numbers.split(',') if n.strip()]
        else:
            num_strs = [n.strip() for n in numbers.split() if n.strip()]
        
        if len(num_strs) < 2:
            return _err("Please provide at least two numbers to add", "VALIDATION_ERROR")
        
        # Convert all to numbers
        nums = []
        for num_str in num_strs:
            try:
                nums.append(_safe_convert_number(num_str))
            except ValueError as e:
                return _err(f"Invalid number '{num_str}': {str(e)}", "VALIDATION_ERROR")
        
        # Sum all numbers
        result = sum(nums)
        return _ok(result)
    except ValueError as e:
        return _err(str(e), "VALIDATION_ERROR")
    except Exception as e:
        return _err(f"Addition error: {str(e)}", "MATH_ERROR")

@mcp.tool()
def subtract(a: Union[str, int, float], b: Union[str, int, float]) -> dict:
    """Subtract two numbers. Supports any numeric value regardless of size."""
    try:
        num_a = _safe_convert_number(a)
        num_b = _safe_convert_number(b)
        result = num_a - num_b
        return _ok(result)
    except ValueError as e:
        return _err(str(e), "VALIDATION_ERROR")
    except Exception as e:
        return _err(f"Subtraction error: {str(e)}", "MATH_ERROR")

@mcp.tool()
def multiply(a: Union[str, int, float], b: Union[str, int, float]) -> dict:
    """Multiply two numbers. Supports any numeric value regardless of size."""
    try:
        num_a = _safe_convert_number(a)
        num_b = _safe_convert_number(b)
        result = num_a * num_b
        return _ok(result)
    except ValueError as e:
        return _err(str(e), "VALIDATION_ERROR")
    except Exception as e:
        return _err(f"Multiplication error: {str(e)}", "MATH_ERROR")

@mcp.tool()
def divide(a: Union[str, int, float], b: Union[str, int, float]) -> dict:
    """Divide two numbers. Supports any numeric value regardless of size."""
    try:
        num_a = _safe_convert_number(a)
        num_b = _safe_convert_number(b)
        if num_b == 0:
            return _err("Division by zero is not allowed", "MATH_ERROR")
        result = num_a / num_b
        return _ok(result)
    except ValueError as e:
        return _err(str(e), "VALIDATION_ERROR")
    except Exception as e:
        return _err(f"Division error: {str(e)}", "MATH_ERROR")

@mcp.tool()
def power(base: Union[str, int, float], exponent: Union[str, int, float]) -> dict:
    """Raise base to the power of exponent. Supports any numeric value."""
    try:
        num_base = _safe_convert_number(base)
        num_exp = _safe_convert_number(exponent)
        result = pow(num_base, num_exp)
        return _ok(result)
    except ValueError as e:
        return _err(str(e), "VALIDATION_ERROR")
    except OverflowError:
        return _err("Result too large to compute", "MATH_ERROR")
    except Exception as e:
        return _err(f"Power operation error: {str(e)}", "MATH_ERROR")

@mcp.tool()
def sqrt(value: Union[str, int, float]) -> dict:
    """Calculate square root. Supports any positive numeric value."""
    try:
        num = _safe_convert_number(value)
        if num < 0:
            return _err("Square root of negative number is not a real number", "MATH_ERROR")
        result = math.sqrt(num)
        return _ok(result)
    except ValueError as e:
        return _err(str(e), "VALIDATION_ERROR")
    except Exception as e:
        return _err(f"Square root error: {str(e)}", "MATH_ERROR")

@mcp.tool()
def factorial(n: Union[str, int]) -> dict:
    """Calculate factorial of a non-negative integer. Supports large integers."""
    try:
        num = _safe_convert_number(n)
        if isinstance(num, float) and not num.is_integer():
            return _err("Factorial requires an integer", "VALIDATION_ERROR")
        num = int(num)
        if num < 0:
            return _err("Factorial of negative number is undefined", "MATH_ERROR")
        if num > 10000:
            return _err("Factorial too large (max 10000)", "MATH_ERROR")
        result = math.factorial(num)
        return _ok(result)
    except ValueError as e:
        return _err(str(e), "VALIDATION_ERROR")
    except OverflowError:
        return _err("Factorial result too large", "MATH_ERROR")
    except Exception as e:
        return _err(f"Factorial error: {str(e)}", "MATH_ERROR")

@mcp.tool()
def log(value: Union[str, int, float], base: Union[str, int, float] = "e") -> dict:
    """Calculate logarithm. Default is natural log (base e)."""
    try:
        num = _safe_convert_number(value)
        if num <= 0:
            return _err("Logarithm requires positive number", "MATH_ERROR")
        if base == "e" or base == math.e:
            result = math.log(num)
        else:
            base_num = _safe_convert_number(base)
            if base_num <= 0 or base_num == 1:
                return _err("Logarithm base must be positive and not equal to 1", "MATH_ERROR")
            result = math.log(num, base_num)
        return _ok(result)
    except ValueError as e:
        return _err(str(e), "VALIDATION_ERROR")
    except Exception as e:
        return _err(f"Logarithm error: {str(e)}", "MATH_ERROR")

@mcp.tool()
def sin(angle: Union[str, int, float], unit: str = "radians") -> dict:
    """Calculate sine. Angle can be in radians (default) or degrees."""
    try:
        num = _safe_convert_number(angle)
        if unit.lower() == "degrees":
            num = math.radians(num)
        result = math.sin(num)
        return _ok(result)
    except ValueError as e:
        return _err(str(e), "VALIDATION_ERROR")
    except Exception as e:
        return _err(f"Sine error: {str(e)}", "MATH_ERROR")

@mcp.tool()
def cos(angle: Union[str, int, float], unit: str = "radians") -> dict:
    """Calculate cosine. Angle can be in radians (default) or degrees."""
    try:
        num = _safe_convert_number(angle)
        if unit.lower() == "degrees":
            num = math.radians(num)
        result = math.cos(num)
        return _ok(result)
    except ValueError as e:
        return _err(str(e), "VALIDATION_ERROR")
    except Exception as e:
        return _err(f"Cosine error: {str(e)}", "MATH_ERROR")

@mcp.tool()
def tan(angle: Union[str, int, float], unit: str = "radians") -> dict:
    """Calculate tangent. Angle can be in radians (default) or degrees."""
    try:
        num = _safe_convert_number(angle)
        if unit.lower() == "degrees":
            num = math.radians(num)
        result = math.tan(num)
        return _ok(result)
    except ValueError as e:
        return _err(str(e), "VALIDATION_ERROR")
    except Exception as e:
        return _err(f"Tangent error: {str(e)}", "MATH_ERROR")

