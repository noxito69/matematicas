from flask import Flask, request, jsonify
from flask_cors import CORS
from sympy import symbols, integrate, sympify, simplify, latex, Eq, Derivative
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application
import logging

app = Flask(__name__)
CORS(app)  # Habilitar CORS para todas las rutas

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Transformaciones para el parser
transformations = (standard_transformations + (implicit_multiplication_application,))

@app.route('/integrate', methods=['POST'])
def integrate_expression():
    data = request.json
    expr = data.get('expression')
    variable = data.get('variable')

    if not expr or not variable:
        return jsonify({'error': 'Se requieren expresión y variable'}), 400

    try:
        logger.info(f"Resolviendo integral de {expr} respecto a {variable}")
        
        # Definir la variable simbólica
        var = symbols(variable)
        
        # Convertir la expresión a un formato simbólico
        symbolic_expr = parse_expr(expr, transformations=transformations, evaluate=False)
        
        # Calcular la integral
        integral_result = integrate(symbolic_expr, var)
        
        # Simplificar el resultado
        simplified_result = simplify(integral_result)
        
        # Convertir a LaTeX para mejor visualización
        latex_result = latex(simplified_result)
        
        logger.info(f"Resultado: {simplified_result}")
        
        return jsonify({
            'result': str(simplified_result),
            'latex': latex_result,
            'status': 'success'
        })
        
    except Exception as e:
        logger.error(f"Error al integrar: {str(e)}")
        return jsonify({
            'error': f"No se pudo resolver la integral: {str(e)}",
            'input_expr': expr,
            'variable': variable,
            'status': 'error'
        }), 400

@app.route('/solve_ode', methods=['POST'])
def solve_ode():
    data = request.json
    equation = data.get('equation')
    
    if not equation:
        return jsonify({'error': 'Se requiere una ecuación diferencial'}), 400

    try:
        logger.info(f"Resolviendo ecuación diferencial: {equation}")
        
        # Parsear la ecuación
        x = symbols('x')
        y = symbols('y', cls=Function)
        
        # Convertir la ecuación a formato sympy
        ode = parse_expr(equation, transformations=transformations, evaluate=False)
        
        # Resolver la ecuación diferencial
        solution = dsolve(ode, y(x))
        
        # Simplificar el resultado
        simplified_solution = simplify(solution)
        
        # Convertir a LaTeX
        latex_solution = latex(simplified_solution)
        
        logger.info(f"Solución: {simplified_solution}")
        
        return jsonify({
            'solution': str(simplified_solution),
            'latex': latex_solution,
            'status': 'success'
        })
        
    except Exception as e:
        logger.error(f"Error al resolver la ODE: {str(e)}")
        return jsonify({
            'error': f"No se pudo resolver la ecuación diferencial: {str(e)}",
            'input_equation': equation,
            'status': 'error'
        }), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)