import typer

app = typer.Typer()

@app.command()
def main():
    typer.echo("Hello, World!")

@app.command()
def frontend():
    """
    지정된 경로의 Streamlit 프론트엔드를 실행하는 명령어입니다.
    """
    import subprocess
    import os

    streamlit_file = r".\frontend\structure_vis.py"

    if not os.path.exists(streamlit_file):
        typer.echo("Streamlit 프론트엔드 파일을 찾을 수 없습니다.")
        raise typer.Exit(code=1)

    typer.echo("Streamlit 프론트엔드를 실행합니다...")
    try:
        subprocess.run(
            ["streamlit", "run", streamlit_file],
            check=True
        )
    except subprocess.CalledProcessError as e:
        typer.echo(f"Streamlit 실행 중 오류 발생: {e}")
        raise typer.Exit(code=1)


@app.command()
def backend():
    """
    지정된 경로의 FastAPI 백엔드를 실행하는 명령어입니다.
    """
    import subprocess
    import os

    backend_file = r".\backend\main.py"

    if not os.path.exists(backend_file):
        typer.echo("FastAPI 백엔드 파일을 찾을 수 없습니다.")
        raise typer.Exit(code=1)
    
    typer.echo("FastAPI 백엔드를 실행합니다...")
    try:
        subprocess.run(
            ["uvicorn", "backend.main:app", "--reload"],
            check=True
        )
    except subprocess.CalledProcessError as e:
        typer.echo(f"FastAPI 실행 중 오류 발생: {e}")
        raise typer.Exit(code=1)


if __name__ == "__main__":
    app()