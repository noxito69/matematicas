from flask import Flask, request, jsonify
from flask_cors import CORS
from sympy import symbols, integrate, simplify, latex, sympify
from sympy.parsing.sympy_parser import (parse_expr, standard_transformations,
                                       implicit_multiplication_application, convert_xor)
import logging

app = Flask(__name__)
CORS(app)

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Transformaciones para el parser
transformations = (standard_transformations +
                  (implicit_multiplication_application, convert_xor))

def preprocess_expression(expr):
    """Preprocesa la expresión para SymPy"""
    # Reemplazar ^ por **
    expr = expr.replace('^', '**')
    
    # Asegurar multiplicación implícita
    expr = expr.replace(')(', ')*(')
    
    return expr

@app.route('/integrate', methods=['POST'])
def integrate_expression():
    data = request.json
    expr = data.get('expression')
    variable = data.get('variable')

    if not expr or not variable:
        return jsonify({
            'error': 'Missing expression or variable',
            'latex': '\\text{Error: Falta expresión o variable}',
            'result': 'Error: Missing expression or variable'
        }), 400

    try:
        logger.info(f"Integrating {expr} with respect to {variable}")
        
        # Preprocesar expresión
        expr_clean = preprocess_expression(expr)
        
        # Definir variables
        var = symbols(variable)
        x = symbols('x')
        y = symbols('y')
        
        # Parsear expresión
        symbolic_expr = parse_expr(expr_clean, transformations=transformations,
                                 locals={'x': x, 'y': y}, evaluate=False)
        
        # Integrar
        integral = integrate(symbolic_expr, var)
        
        # Simplificar
        simplified = simplify(integral)
        
        # Convertir a LaTeX
        latex_output = latex(simplified, mode='plain')
        
        logger.info(f"Result: {simplified}")
        
        return jsonify({
            'result': str(simplified),
            'latex': latex_output,
            'status': 'success'
        })
        
    except Exception as e:
        logger.error(f"Integration error: {str(e)}")
        return jsonify({
            'error': str(e),
            'latex': f'\\text{{Error: {str(e)}}}',
            'result': f'Error: {str(e)}',
            'status': 'error'
        }), 400

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)